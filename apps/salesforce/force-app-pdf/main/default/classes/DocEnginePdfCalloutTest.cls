@IsTest
private class DocEnginePdfCalloutTest {
  private class PdfMock implements HttpCalloutMock {
    public HTTPResponse respond(HTTPRequest req) {
      System.assert(req.getEndpoint().contains('/pdf/generate'));
      System.assertEquals('POST', req.getMethod());
      HttpResponse res = new HttpResponse();
      res.setStatusCode(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setBodyAsBlob(Blob.valueOf('%PDF-1.4 mock'));
      return res;
    }
  }

  private class PdfErrorMock implements HttpCalloutMock {
    public HTTPResponse respond(HTTPRequest req) {
      HttpResponse res = new HttpResponse();
      res.setStatusCode(500);
      res.setBody('{"error":"boom"}');
      return res;
    }
  }

  private static DocEngine_Document__c seedInstance() {
    DocEngine_Template__c t = new DocEngine_Template__c(
      Name = 'T',
      Object_API_Name__c = 'Account',
      Template_JSON__c = '{"kind":"template","blocks":[],"fieldSchemas":{}}',
      Is_Active__c = true,
      Version__c = 1,
      PDF_Filename__c = 'agreement.pdf'
    );
    insert t;
    Account a = new Account(Name = 'Acme');
    insert a;
    DocEngine_Document__c inst = new DocEngine_Document__c(
      Template__c = t.Id,
      Record_Id__c = a.Id,
      Object_API_Name__c = 'Account',
      Document_JSON__c = '{"kind":"document","version":1,"blocks":[],"fieldSchemas":{}}',
      Status__c = 'Draft'
    );
    insert inst;
    return inst;
  }

  @IsTest
  static void callableGeneratePdfBase64() {
    Test.setMock(HttpCalloutMock.class, new PdfMock());
    DocEnginePdfCallout callout = new DocEnginePdfCallout();
    Test.startTest();
    Object b64 = callout.call(
      'generatePdfBase64',
      new Map<String, Object>{
        'documentJson' => '{"kind":"document","version":1,"blocks":[],"fieldSchemas":{}}'
      }
    );
    Test.stopTest();
    System.assert(b64 instanceof String);
    System.assert(String.isNotBlank((String) b64));
  }

  private static void enableExternalPdf() {
    DocEngine_Settings__c settings = DocEngine_Settings__c.getOrgDefaults();
    settings.Use_External_PDF__c = true;
    upsert settings;
  }

  @IsTest
  static void facadeGenerateAndSavePdf() {
    enableExternalPdf();
    DocEngine_Document__c inst = seedInstance();
    Test.setMock(HttpCalloutMock.class, new PdfMock());
    Test.startTest();
    // html is unused for External provider; signature still requires the second arg.
    DocEnginePdfController.PdfGenerateResult result = DocEnginePdfController.generateAndSavePdf(
      inst.Id,
      null
    );
    Test.stopTest();
    System.assertEquals(inst.Id, result.docInstanceId);
    System.assertNotEquals(null, result.contentDocumentId);
  }

  @IsTest
  static void facadeSurfacesServiceError() {
    enableExternalPdf();
    DocEngine_Document__c inst = seedInstance();
    Test.setMock(HttpCalloutMock.class, new PdfErrorMock());
    Boolean threw = false;
    try {
      Test.startTest();
      DocEnginePdfController.generateAndSavePdf(inst.Id, null);
      Test.stopTest();
    } catch (AuraHandledException e) {
      threw = true;
      System.assert(e.getMessage().contains('boom') || e.getMessage().contains('500'));
    }
    System.assert(threw);
  }

  @IsTest
  static void unknownActionThrows() {
    Boolean threw = false;
    try {
      new DocEnginePdfCallout().call('nope', new Map<String, Object>());
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw);
  }
}
