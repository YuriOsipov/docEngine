/**
 * Optional DocEngine_PDF package — Callable implementation discovered by DocEnginePdfController.
 *
 * Actions:
 *   generatePdfBase64     — args.documentJson (String) → String base64
 *   generatePdfPreviewUrl — args.documentJson (String) → String https/relative URL for iframe (LWS-safe)
 *   generateAndSavePdf    — args.docInstanceId (Id) → Map contentVersionId, contentDocumentId, docInstanceId
 *
 * Requires Named Credential DocEngine_Pdf → HTTPS pdf-service base URL.
 */
public with sharing class DocEnginePdfCallout implements System.Callable {
  private static final String NAMED_CREDENTIAL = 'DocEngine_Pdf';
  private static final String GENERATE_PATH = '/pdf/generate';
  private static final Integer TIMEOUT_MS = 120000;

  public Object call(String action, Map<String, Object> args) {
    if (args == null) {
      args = new Map<String, Object>();
    }
    if (action == 'generatePdfBase64') {
      String documentJson = (String) args.get('documentJson');
      if (String.isBlank(documentJson)) {
        throw new AuraHandledException('documentJson is required.');
      }
      Blob pdfBlob = callPdfServiceWithBody(documentJson, null);
      return EncodingUtil.base64Encode(pdfBlob);
    }
    if (action == 'generatePdfPreviewUrl') {
      String documentJson = (String) args.get('documentJson');
      if (String.isBlank(documentJson)) {
        throw new AuraHandledException('documentJson is required.');
      }
      return storePreviewAndGetUrl(callPdfServiceWithBody(documentJson, null));
    }
    if (action == 'generateAndSavePdf') {
      Id docInstanceId = (Id) args.get('docInstanceId');
      return generateAndSave(docInstanceId);
    }
    throw new AuraHandledException('Unknown DocEnginePdfCallout action: ' + action);
  }

  /**
   * Store PDF as a user-owned File and return a same-org HTTPS URL for iframe preview.
   * LWS blocks blob:/data: on iframe.src — ContentDistribution view URL is https.
   */
  @TestVisible
  private static String storePreviewAndGetUrl(Blob pdfBlob) {
    ContentVersion cv = new ContentVersion();
    cv.Title = 'DocEngine Preview';
    cv.PathOnClient = 'docengine-preview.pdf';
    cv.VersionData = pdfBlob;
    cv.FirstPublishLocationId = UserInfo.getUserId();
    insert cv;

    ContentDistribution dist = new ContentDistribution();
    dist.Name = 'DocEngine Preview ' + String.valueOf(Datetime.now().getTime());
    dist.ContentVersionId = cv.Id;
    dist.PreferencesAllowViewInBrowser = true;
    dist.PreferencesLinkLatestVersion = true;
    dist.PreferencesAllowOriginalDownload = true;
    dist.PreferencesPasswordRequired = false;
    dist.PreferencesNotifyOnVisit = false;
    insert dist;

    dist = [
      SELECT ContentDownloadUrl, DistributionPublicUrl
      FROM ContentDistribution
      WHERE Id = :dist.Id
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];

    if (String.isNotBlank(dist.ContentDownloadUrl)) {
      return dist.ContentDownloadUrl;
    }
    if (String.isNotBlank(dist.DistributionPublicUrl)) {
      return dist.DistributionPublicUrl;
    }
    // Fallback: authenticated relative download (may download instead of inline in some browsers)
    return '/sfc/servlet.shepherd/version/download/' + cv.Id;
  }

  private static Map<String, Object> generateAndSave(Id docInstanceId) {
    if (docInstanceId == null) {
      throw new AuraHandledException('docInstanceId is required.');
    }

    DocEngine_Document__c instance = [
      SELECT
        Id,
        Name,
        Record_Id__c,
        Document_JSON__c,
        Template__c,
        Template__r.Template_JSON__c,
        Template__r.PDF_Filename__c,
        Template__r.Name,
        Template_Version__c,
        Template_Version__r.Template_JSON__c
      FROM DocEngine_Document__c
      WHERE Id = :docInstanceId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];

    if (String.isBlank(instance.Document_JSON__c)) {
      throw new AuraHandledException('Document JSON is empty. Save the instance before generating PDF.');
    }

    String templateJson = null;
    if (
      instance.Template_Version__r != null &&
      String.isNotBlank(instance.Template_Version__r.Template_JSON__c)
    ) {
      templateJson = instance.Template_Version__r.Template_JSON__c;
    } else if (instance.Template__r != null) {
      templateJson = instance.Template__r.Template_JSON__c;
    }

    Blob pdfBlob = callPdfServiceWithBody(instance.Document_JSON__c, templateJson);
    String filename = resolveFilename(instance);

    DocEngineInstanceController.PdfSaveResult saved = DocEngineInstanceController.savePdfFromBlob(
      instance.Id,
      pdfBlob,
      filename
    );

    return new Map<String, Object>{
      'contentVersionId' => saved.contentVersionId,
      'contentDocumentId' => saved.contentDocumentId,
      'docInstanceId' => instance.Id
    };
  }

  @TestVisible
  private static Blob callPdfServiceWithBody(String documentJson, String templateJson) {
    Map<String, Object> body = new Map<String, Object>();
    Object documentObj = JSON.deserializeUntyped(documentJson);
    body.put('document', documentObj);

    if (String.isNotBlank(templateJson)) {
      try {
        Object templateObj = JSON.deserializeUntyped(templateJson);
        if (templateObj instanceof Map<String, Object>) {
          Map<String, Object> templateMap = (Map<String, Object>) templateObj;
          Map<String, Object> documentMap = documentObj instanceof Map<String, Object>
            ? (Map<String, Object>) documentObj
            : null;
          String docKind = documentMap == null ? null : (String) documentMap.get('kind');
          Boolean hasBlocks =
            documentMap != null && documentMap.get('blocks') instanceof List<Object>;
          if (docKind == 'field' || (docKind == 'document' && !hasBlocks)) {
            body.put('template', templateMap);
          }
        }
      } catch (Exception e) {
        // document-only
      }
    }

    HttpRequest req = new HttpRequest();
    req.setEndpoint('callout:' + NAMED_CREDENTIAL + GENERATE_PATH);
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setTimeout(TIMEOUT_MS);
    req.setBody(JSON.serialize(body));

    HttpResponse res = new Http().send(req);
    Integer status = res.getStatusCode();
    if (status < 200 || status >= 300) {
      String errBody = res.getBody();
      String message = 'PDF service error (' + status + ')';
      if (String.isNotBlank(errBody)) {
        try {
          Map<String, Object> err = (Map<String, Object>) JSON.deserializeUntyped(errBody);
          if (err.containsKey('error')) {
            message += ': ' + String.valueOf(err.get('error'));
          } else {
            message += ': ' + errBody.left(500);
          }
        } catch (Exception e) {
          message += ': ' + errBody.left(500);
        }
      }
      throw new AuraHandledException(message);
    }

    Blob pdf = res.getBodyAsBlob();
    if (pdf == null || pdf.size() < 5) {
      throw new AuraHandledException('PDF service returned an empty response.');
    }
    return pdf;
  }

  private static String resolveFilename(DocEngine_Document__c instance) {
    if (instance.Template__r != null && String.isNotBlank(instance.Template__r.PDF_Filename__c)) {
      return instance.Template__r.PDF_Filename__c;
    }
    if (String.isNotBlank(instance.Name)) {
      return instance.Name + '.pdf';
    }
    return 'document.pdf';
  }
}
