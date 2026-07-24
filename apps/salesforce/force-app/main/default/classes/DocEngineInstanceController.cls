/**
 * CRUD for DocEngine_Document__c — filled documents linked to any Salesforce record.
 * PDF storage via ContentVersion + ContentDocumentLink (instance + source record).
 */
public with sharing class DocEngineInstanceController {
  public class InstanceDTO {
    @AuraEnabled public Id id { get; set; }
    @AuraEnabled public String name { get; set; }
    @AuraEnabled public Id templateId { get; set; }
    /** Pinned DocEngine_Template_Version__c used for this fill. */
    @AuraEnabled public Id templateVersionId { get; set; }
    /** Template JSON from the pinned version (reopen); null when unset/legacy. */
    @AuraEnabled public String templateJson { get; set; }
    @AuraEnabled public Decimal templateVersion { get; set; }
    @AuraEnabled public String recordId { get; set; }
    @AuraEnabled public String objectApiName { get; set; }
    @AuraEnabled public String documentJson { get; set; }
    @AuraEnabled public String status { get; set; }
    @AuraEnabled public Datetime completedDate { get; set; }
  }

  public class InstanceSummary {
    @AuraEnabled public Id id { get; set; }
    @AuraEnabled public String name { get; set; }
    @AuraEnabled public Id templateId { get; set; }
    @AuraEnabled public String templateName { get; set; }
    @AuraEnabled public String status { get; set; }
    @AuraEnabled public Datetime completedDate { get; set; }
    @AuraEnabled public Datetime lastModifiedDate { get; set; }
    /** Attached ContentDocument Id when a file was saved on Complete. */
    @AuraEnabled public String contentDocumentId { get; set; }
    /** Lightning preview URL for the attached file (null when none). */
    @AuraEnabled public String fileUrl { get; set; }
  }

  public class FileSaveResult {
    @AuraEnabled public Id contentVersionId { get; set; }
    @AuraEnabled public Id contentDocumentId { get; set; }
  }

  /** Result of prepareShare — file on record plus optional public Content Delivery URL. */
  public class SharePrepareResult {
    @AuraEnabled public Id contentVersionId { get; set; }
    @AuraEnabled public Id contentDocumentId { get; set; }
    @AuraEnabled public String publicUrl { get; set; }
    @AuraEnabled public String filename { get; set; }
  }

  /** @deprecated Use FileSaveResult — kept for binary compatibility with existing LWCs. */
  public class PdfSaveResult {
    @AuraEnabled public Id contentVersionId { get; set; }
    @AuraEnabled public Id contentDocumentId { get; set; }
  }

  @AuraEnabled(cacheable=true)
  public static InstanceDTO getInstance(Id instanceId) {
    if (instanceId == null) {
      throw new AuraHandledException('instanceId is required.');
    }
    List<DocEngine_Document__c> rows = [
      SELECT
        Id,
        Name,
        Template__c,
        Template__r.Access_Group_Id__c,
        Template_Version__c,
        Template_Version__r.Template_JSON__c,
        Template_Version__r.Version__c,
        Record_Id__c,
        Object_API_Name__c,
        Document_JSON__c,
        Status__c,
        Completed_Date__c
      FROM DocEngine_Document__c
      WHERE Id = :instanceId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (rows.isEmpty()) {
      throw new AuraHandledException('Document instance not found.');
    }
    String groupId = rows[0].Template__r != null
      ? rows[0].Template__r.Access_Group_Id__c
      : null;
    DocEngineAccess.assertGroupAccess(groupId);
    return toDto(rows[0]);
  }

  /**
   * Instances for a source record (record page related list / picker).
   */
  @AuraEnabled(cacheable=true)
  public static List<InstanceSummary> listForRecord(String recordId) {
    if (String.isBlank(recordId)) {
      throw new AuraHandledException('recordId is required.');
    }
    List<DocEngine_Document__c> rows = [
      SELECT
        Id,
        Name,
        Template__c,
        Template__r.Name,
        Template__r.Access_Group_Id__c,
        Status__c,
        Completed_Date__c,
        LastModifiedDate,
        Content_Document_Id__c
      FROM DocEngine_Document__c
      WHERE Record_Id__c = :recordId
      WITH SECURITY_ENFORCED
      ORDER BY LastModifiedDate DESC
    ];
    List<InstanceSummary> out = new List<InstanceSummary>();
    for (DocEngine_Document__c row : rows) {
      String groupId = row.Template__r != null ? row.Template__r.Access_Group_Id__c : null;
      if (!DocEngineAccess.canAccessByGroup(groupId)) {
        continue;
      }
      InstanceSummary s = new InstanceSummary();
      s.id = row.Id;
      s.name = row.Name;
      s.templateId = row.Template__c;
      s.templateName = row.Template__r != null ? row.Template__r.Name : null;
      s.status = row.Status__c;
      s.completedDate = row.Completed_Date__c;
      s.lastModifiedDate = row.LastModifiedDate;
      if (String.isNotBlank(row.Content_Document_Id__c)) {
        s.contentDocumentId = row.Content_Document_Id__c.trim();
        s.fileUrl = contentDocumentViewUrl(s.contentDocumentId);
      }
      out.add(s);
    }
    return out;
  }

  @AuraEnabled
  public static void deleteInstance(Id instanceId) {
    if (instanceId == null) {
      throw new AuraHandledException('instanceId is required.');
    }
    DocEngineAccess.assertDocumentAccess(instanceId);
    if (!Schema.sObjectType.DocEngine_Document__c.isDeletable()) {
      throw new AuraHandledException('Insufficient access to delete document instances.');
    }
    List<DocEngine_Document__c> rows = [
      SELECT Id, Content_Document_Id__c
      FROM DocEngine_Document__c
      WHERE Id = :instanceId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (rows.isEmpty()) {
      throw new AuraHandledException('Document instance not found.');
    }
    deleteLinkedContentDocument(rows[0].Content_Document_Id__c);
    // USER_MODE enforces CRUD + sharing for the running user (not only UI).
    Database.delete(rows, AccessLevel.USER_MODE);
  }

  @AuraEnabled
  public static InstanceDTO saveInstance(InstanceDTO dto) {
    if (dto == null) {
      throw new AuraHandledException('Instance payload is required.');
    }
    if (dto.templateId == null) {
      throw new AuraHandledException('templateId is required.');
    }
    if (String.isBlank(dto.recordId)) {
      throw new AuraHandledException('recordId is required.');
    }
    if (String.isBlank(dto.objectApiName)) {
      throw new AuraHandledException('objectApiName is required.');
    }
    if (String.isBlank(dto.documentJson)) {
      throw new AuraHandledException('documentJson is required.');
    }

    DocEngineAccess.assertTemplateAccess(dto.templateId);
    if (dto.id != null) {
      DocEngineAccess.assertDocumentAccess(dto.id);
    }

    DocEngine_Document__c row = dto.id != null
      ? [
          SELECT Id, Status__c, Completed_Date__c, Template_Version__c
          FROM DocEngine_Document__c
          WHERE Id = :dto.id
          WITH SECURITY_ENFORCED
          LIMIT 1
        ]
      : new DocEngine_Document__c();

    row.Template__c = dto.templateId;
    row.Record_Id__c = dto.recordId.trim();
    row.Object_API_Name__c = dto.objectApiName.trim();
    row.Document_JSON__c = dto.documentJson;

    // Pin template version on first save; never retarget on later drafts/completes.
    if (row.Template_Version__c == null) {
      if (dto.templateVersionId != null) {
        row.Template_Version__c = dto.templateVersionId;
      } else {
        row.Template_Version__c = DocEngineTemplateController.ensureCurrentVersionId(dto.templateId);
      }
    }

    String status = String.isBlank(dto.status) ? 'Draft' : dto.status.trim();
    row.Status__c = status;
    if (status == 'Completed' && row.Completed_Date__c == null) {
      row.Completed_Date__c = System.now();
    }
    if (dto.completedDate != null) {
      row.Completed_Date__c = dto.completedDate;
    }

    SObjectAccessDecision decision = Security.stripInaccessible(
      AccessType.UPSERTABLE,
      new List<DocEngine_Document__c>{ row }
    );
    List<DocEngine_Document__c> safe = (List<DocEngine_Document__c>) decision.getRecords();
    upsert safe;
    return getInstance(safe[0].Id);
  }

  /**
   * Store a PDF against the DocEngine_Document__c and the source record (Files related list).
   */
  @AuraEnabled
  public static PdfSaveResult savePdf(Id docInstanceId, String base64Data, String filename) {
    if (String.isBlank(base64Data)) {
      throw new AuraHandledException('base64Data is required.');
    }
    FileSaveResult file = saveFileFromBlob(
      docInstanceId,
      EncodingUtil.base64Decode(base64Data),
      filename,
      'pdf'
    );
    PdfSaveResult result = new PdfSaveResult();
    result.contentVersionId = file.contentVersionId;
    result.contentDocumentId = file.contentDocumentId;
    return result;
  }

  /**
   * Attach a PDF Blob (used by DocEnginePdfController after callout — avoids base64 round-trip).
   */
  public static PdfSaveResult savePdfFromBlob(Id docInstanceId, Blob pdfBlob, String filename) {
    FileSaveResult file = saveFileFromBlob(docInstanceId, pdfBlob, filename, 'pdf');
    PdfSaveResult result = new PdfSaveResult();
    result.contentVersionId = file.contentVersionId;
    result.contentDocumentId = file.contentDocumentId;
    return result;
  }

  /**
   * Attach HTML (base64) to the DocEngine_Document__c and source record Files list.
   */
  @AuraEnabled
  public static FileSaveResult saveHtml(Id docInstanceId, String base64Data, String filename) {
    if (String.isBlank(base64Data)) {
      throw new AuraHandledException('base64Data is required.');
    }
    return saveFileFromBlob(
      docInstanceId,
      EncodingUtil.base64Decode(base64Data),
      filename,
      'html'
    );
  }

  /**
   * Save preview artifact to Files and create a Content Delivery public URL when possible.
   * Hosts use this for email / Slack / copy-link share flows.
   */
  @AuraEnabled
  public static SharePrepareResult prepareShare(
    Id docInstanceId,
    String base64Data,
    String filename,
    String format
  ) {
    if (String.isBlank(base64Data)) {
      throw new AuraHandledException('base64Data is required.');
    }
    String kind = String.isBlank(format) ? 'html' : format.trim().toLowerCase();
    if (kind != 'pdf' && kind != 'html') {
      kind = 'html';
    }
    FileSaveResult file = saveFileFromBlob(
      docInstanceId,
      EncodingUtil.base64Decode(base64Data),
      filename,
      kind
    );

    SharePrepareResult out = new SharePrepareResult();
    out.contentVersionId = file.contentVersionId;
    out.contentDocumentId = file.contentDocumentId;
    out.filename = String.isBlank(filename)
      ? ('document.' + kind)
      : filename;

    try {
      ContentDistribution cd = new ContentDistribution();
      String title = out.filename;
      Integer dot = title.lastIndexOf('.');
      if (dot > 0) {
        title = title.substring(0, dot);
      }
      cd.Name = title.left(100);
      cd.ContentVersionId = file.contentVersionId;
      cd.PreferencesAllowViewInBrowser = true;
      cd.PreferencesLinkLatestVersion = true;
      cd.PreferencesNotifyOnVisit = false;
      cd.PreferencesPasswordRequired = false;
      cd.PreferencesAllowOriginalDownload = true;
      insert cd;

      ContentDistribution created = [
        SELECT Id, DistributionPublicUrl, ContentDownloadUrl
        FROM ContentDistribution
        WHERE Id = :cd.Id
        WITH SECURITY_ENFORCED
        LIMIT 1
      ];
      out.publicUrl = String.isNotBlank(created.DistributionPublicUrl)
        ? created.DistributionPublicUrl
        : created.ContentDownloadUrl;
    } catch (Exception e) {
      // Content Deliveries may be disabled — file is still on the record.
      out.publicUrl = null;
    }
    return out;
  }

  /**
   * Email the saved file (ContentVersion) to one or more addresses.
   * When createTask is true and docInstanceId resolves to a parent Record_Id__c,
   * inserts a Completed Task on that parent (Account, Sales Order, etc.).
   * Requires org email deliverability; fails with a clear AuraHandledException otherwise.
   */
  @AuraEnabled
  public static void sendShareEmail(
    Id contentVersionId,
    String toAddresses,
    String subject,
    String body,
    Boolean createTask,
    Id docInstanceId
  ) {
    if (contentVersionId == null) {
      throw new AuraHandledException('contentVersionId is required.');
    }
    if (String.isBlank(toAddresses)) {
      throw new AuraHandledException('At least one recipient email is required.');
    }

    List<String> recipients = new List<String>();
    for (String part : toAddresses.split('[,;]')) {
      String email = part == null ? '' : part.trim();
      if (String.isNotBlank(email)) {
        recipients.add(email);
      }
    }
    if (recipients.isEmpty()) {
      throw new AuraHandledException('At least one recipient email is required.');
    }
    if (recipients.size() > 10) {
      throw new AuraHandledException('Too many recipients (max 10).');
    }

    ContentVersion cv = [
      SELECT Id, Title, PathOnClient, VersionData, FileExtension
      FROM ContentVersion
      WHERE Id = :contentVersionId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];

    Messaging.EmailFileAttachment attachment = new Messaging.EmailFileAttachment();
    String fileName = String.isNotBlank(cv.PathOnClient) ? cv.PathOnClient : (cv.Title + '.bin');
    attachment.setFileName(fileName);
    attachment.setBody(cv.VersionData);
    String ext = String.isBlank(cv.FileExtension) ? '' : cv.FileExtension.toLowerCase();
    if (ext == 'pdf') {
      attachment.setContentType('application/pdf');
    } else if (ext == 'html' || ext == 'htm') {
      attachment.setContentType('text/html');
    }

    String resolvedSubject = String.isBlank(subject) ? fileName : subject;
    String resolvedBody = String.isBlank(body)
      ? 'Please find the attached document.'
      : body;

    Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
    mail.setToAddresses(recipients);
    mail.setSubject(resolvedSubject);
    mail.setPlainTextBody(resolvedBody);
    mail.setFileAttachments(new List<Messaging.EmailFileAttachment>{ attachment });
    mail.setSaveAsActivity(false);

    try {
      Messaging.SendEmailResult[] results = Messaging.sendEmail(
        new List<Messaging.SingleEmailMessage>{ mail },
        false
      );
      if (results == null || results.isEmpty() || !results[0].isSuccess()) {
        String err = 'Email send failed.';
        if (results != null && !results.isEmpty() && results[0].getErrors() != null && !results[0].getErrors().isEmpty()) {
          err = results[0].getErrors()[0].getMessage();
        }
        throw new AuraHandledException(err);
      }
    } catch (AuraHandledException ahe) {
      throw ahe;
    } catch (Exception e) {
      throw new AuraHandledException(
        'Email send failed: ' + e.getMessage() +
        ' Check Deliverability (Setup → Email → Deliverability) and that outbound email is allowed.'
      );
    }

    if (createTask == true) {
      createShareEmailTask(docInstanceId, recipients, resolvedSubject, resolvedBody);
    }
  }

  /**
   * Creates a Completed Task on the document's parent record (Record_Id__c).
   * No-ops when parent is missing or Activities are not allowed on that object.
   */
  private static void createShareEmailTask(
    Id docInstanceId,
    List<String> recipients,
    String subject,
    String body
  ) {
    if (docInstanceId == null) {
      return;
    }
    DocEngineAccess.assertDocumentAccess(docInstanceId);

    DocEngine_Document__c instance = [
      SELECT Id, Record_Id__c
      FROM DocEngine_Document__c
      WHERE Id = :docInstanceId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (String.isBlank(instance.Record_Id__c)) {
      return;
    }

    Id whatId;
    try {
      whatId = Id.valueOf(instance.Record_Id__c);
    } catch (Exception e) {
      return;
    }

    Schema.DescribeSObjectResult parentDescribe = whatId.getSObjectType().getDescribe();
    // Activities are enabled when LastActivityDate is present (no Describe isActivityEnabled API).
    if (!parentDescribe.fields.getMap().containsKey('LastActivityDate')) {
      return;
    }
    if (!Schema.sObjectType.Task.isCreateable()) {
      throw new AuraHandledException('Insufficient access to create a Task.');
    }

    Task t = new Task();
    t.Subject = ('Email: ' + subject).left(255);
    t.Description =
      'To: ' + String.join(recipients, ', ') + '\n\n' + (body == null ? '' : body);
    t.Status = 'Completed';
    t.Priority = 'Normal';
    t.ActivityDate = Date.today();
    t.WhatId = whatId;
    t.OwnerId = UserInfo.getUserId();
    if (Schema.sObjectType.Task.fields.TaskSubtype.isCreateable()) {
      t.TaskSubtype = 'Email';
    }

    SObjectAccessDecision decision = Security.stripInaccessible(
      AccessType.CREATABLE,
      new List<Task>{ t }
    );
    insert decision.getRecords();
  }

  /**
   * Attach a file Blob to the instance + source record.
   * When Content_Document_Id__c is set and still valid, inserts a new ContentVersion
   * on that document (edit/revise). Otherwise creates a new ContentDocument and stores its Id.
   * @param fileKind 'pdf' | 'html' — drives PathOnClient extension / MIME expectations.
   */
  public static FileSaveResult saveFileFromBlob(
    Id docInstanceId,
    Blob fileBlob,
    String filename,
    String fileKind
  ) {
    if (docInstanceId == null) {
      throw new AuraHandledException('docInstanceId is required.');
    }
    DocEngineAccess.assertDocumentAccess(docInstanceId);
    if (fileBlob == null || fileBlob.size() == 0) {
      throw new AuraHandledException('File data is required.');
    }
    String kind = String.isBlank(fileKind) ? 'pdf' : fileKind.trim().toLowerCase();
    String ext = kind == 'html' ? '.html' : '.pdf';
    if (String.isBlank(filename)) {
      filename = 'document' + ext;
    }
    if (!filename.toLowerCase().endsWith(ext)) {
      filename = filename + ext;
    }

    DocEngine_Document__c instance = [
      SELECT Id, Record_Id__c, Name, Content_Document_Id__c
      FROM DocEngine_Document__c
      WHERE Id = :docInstanceId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];

    Id existingDocId = resolveExistingContentDocumentId(instance.Content_Document_Id__c);

    ContentVersion cv = new ContentVersion();
    String title = filename;
    Integer dot = title.lastIndexOf('.');
    if (dot > 0) {
      title = title.substring(0, dot);
    }
    cv.Title = title;
    cv.PathOnClient = filename;
    cv.VersionData = fileBlob;
    if (existingDocId != null) {
      cv.ContentDocumentId = existingDocId;
    } else {
      cv.FirstPublishLocationId = instance.Id;
    }
    insert cv;

    cv = [
      SELECT Id, ContentDocumentId
      FROM ContentVersion
      WHERE Id = :cv.Id
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];

    // Link to the source record so the file appears under Files / Notes & Attachments.
    if (String.isNotBlank(instance.Record_Id__c)) {
      Id parentId;
      try {
        parentId = Id.valueOf(instance.Record_Id__c);
      } catch (Exception e) {
        parentId = null;
      }
      if (parentId != null) {
        List<ContentDocumentLink> existing = [
          SELECT Id
          FROM ContentDocumentLink
          WHERE ContentDocumentId = :cv.ContentDocumentId AND LinkedEntityId = :parentId
          WITH SECURITY_ENFORCED
          LIMIT 1
        ];
        if (existing.isEmpty()) {
          ContentDocumentLink link = new ContentDocumentLink();
          link.ContentDocumentId = cv.ContentDocumentId;
          link.LinkedEntityId = parentId;
          link.ShareType = 'V';
          link.Visibility = 'AllUsers';
          insert link;
        }
      }
    }

    String newDocId = String.valueOf(cv.ContentDocumentId);
    if (instance.Content_Document_Id__c != newDocId) {
      DocEngine_Document__c patch = new DocEngine_Document__c(
        Id = instance.Id,
        Content_Document_Id__c = newDocId
      );
      SObjectAccessDecision decision = Security.stripInaccessible(
        AccessType.UPDATABLE,
        new List<DocEngine_Document__c>{ patch }
      );
      update decision.getRecords();
    }

    FileSaveResult result = new FileSaveResult();
    result.contentVersionId = cv.Id;
    result.contentDocumentId = cv.ContentDocumentId;
    return result;
  }

  private static Id resolveExistingContentDocumentId(String rawId) {
    if (String.isBlank(rawId)) {
      return null;
    }
    Id docId;
    try {
      docId = Id.valueOf(rawId.trim());
    } catch (Exception e) {
      return null;
    }
    List<ContentDocument> docs = [
      SELECT Id
      FROM ContentDocument
      WHERE Id = :docId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    return docs.isEmpty() ? null : docs[0].Id;
  }

  private static void deleteLinkedContentDocument(String rawId) {
    Id docId = resolveExistingContentDocumentId(rawId);
    if (docId == null) {
      return;
    }
    try {
      delete new ContentDocument(Id = docId);
    } catch (Exception e) {
      // File may already be gone or user lacks ContentDocument delete — ignore.
    }
  }

  @TestVisible
  private static String contentDocumentViewUrl(String contentDocumentId) {
    if (String.isBlank(contentDocumentId)) {
      return null;
    }
    return '/lightning/r/ContentDocument/' + contentDocumentId.trim() + '/view';
  }

  private static InstanceDTO toDto(DocEngine_Document__c row) {
    InstanceDTO dto = new InstanceDTO();
    dto.id = row.Id;
    dto.name = row.Name;
    dto.templateId = row.Template__c;
    dto.templateVersionId = row.Template_Version__c;
    if (row.Template_Version__r != null) {
      dto.templateJson = row.Template_Version__r.Template_JSON__c;
      dto.templateVersion = row.Template_Version__r.Version__c;
    }
    dto.recordId = row.Record_Id__c;
    dto.objectApiName = row.Object_API_Name__c;
    dto.documentJson = row.Document_JSON__c;
    dto.status = row.Status__c;
    dto.completedDate = row.Completed_Date__c;
    return dto;
  }
}
