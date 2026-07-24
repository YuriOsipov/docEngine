/**
 * CRUD for DocEngine_Template__c — design-mode templates bound to an SObject type.
 * Each save creates an immutable DocEngine_Template_Version__c row and points Current_Version__c at it.
 */
public with sharing class DocEngineTemplateController {
  public class TemplateDTO {
    @AuraEnabled public Id id { get; set; }
    @AuraEnabled public String name { get; set; }
    @AuraEnabled public String objectApiName { get; set; }
    /** Template export JSON; may include embedded fieldMapping. */
    @AuraEnabled public String templateJson { get; set; }
    @AuraEnabled public Boolean isActive { get; set; }
    @AuraEnabled public Decimal version { get; set; }
    /** Id of the version currently loaded / current head. */
    @AuraEnabled public Id versionId { get; set; }
    @AuraEnabled public String description { get; set; }
    @AuraEnabled public String pdfFilename { get; set; }
    /** Public Group Id; blank = no group restriction. */
    @AuraEnabled public String accessGroupId { get; set; }
  }

  public class TemplateSummary {
    @AuraEnabled public Id id { get; set; }
    @AuraEnabled public String name { get; set; }
    @AuraEnabled public String description { get; set; }
    @AuraEnabled public Decimal version { get; set; }
  }

  public class VersionSummary {
    @AuraEnabled public Id id { get; set; }
    @AuraEnabled public Decimal version { get; set; }
    @AuraEnabled public Datetime createdDate { get; set; }
    @AuraEnabled public String createdByName { get; set; }
    @AuraEnabled public Boolean isCurrent { get; set; }
  }

  public class GroupOption {
    @AuraEnabled public String label { get; set; }
    @AuraEnabled public String value { get; set; }
  }

  /**
   * Public Groups for the Access Public Group picker (lookup UX; Group is not a valid Lookup target).
   */
  @AuraEnabled(cacheable=true)
  public static List<GroupOption> listPublicGroups() {
    List<GroupOption> out = new List<GroupOption>();
    for (Group g : [
      SELECT Id, Name
      FROM Group
      WHERE Type = 'Regular'
      ORDER BY Name
      LIMIT 500
    ]) {
      GroupOption opt = new GroupOption();
      opt.label = g.Name;
      opt.value = String.valueOf(g.Id);
      out.add(opt);
    }
    return out;
  }

  /**
   * Resolve the SObject API name for a record Id (e.g. Account, Opportunity).
   */
  @AuraEnabled(cacheable=true)
  public static String getObjectApiName(Id recordId) {
    if (recordId == null) {
      throw new AuraHandledException('recordId is required.');
    }
    return recordId.getSObjectType().getDescribe().getName();
  }

  @AuraEnabled(cacheable=true)
  public static TemplateDTO getTemplate(Id templateId) {
    if (templateId == null) {
      throw new AuraHandledException('templateId is required.');
    }
    List<DocEngine_Template__c> rows = [
      SELECT
        Id,
        Name,
        Object_API_Name__c,
        Template_JSON__c,
        Is_Active__c,
        Version__c,
        Current_Version__c,
        Current_Version__r.Template_JSON__c,
        Current_Version__r.Version__c,
        Description__c,
        PDF_Filename__c,
        Access_Group_Id__c
      FROM DocEngine_Template__c
      WHERE Id = :templateId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (rows.isEmpty()) {
      throw new AuraHandledException('Template not found.');
    }
    DocEngineAccess.assertGroupAccess(rows[0].Access_Group_Id__c);
    return toDto(rows[0]);
  }

  /**
   * Load a specific immutable template version (builder version picker / document reopen).
   */
  @AuraEnabled(cacheable=true)
  public static TemplateDTO getVersion(Id versionId) {
    if (versionId == null) {
      throw new AuraHandledException('versionId is required.');
    }
    List<DocEngine_Template_Version__c> rows = [
      SELECT
        Id,
        Version__c,
        Template_JSON__c,
        Template__c,
        Template__r.Name,
        Template__r.Object_API_Name__c,
        Template__r.Is_Active__c,
        Template__r.Description__c,
        Template__r.PDF_Filename__c,
        Template__r.Access_Group_Id__c,
        Template__r.Current_Version__c,
        Template__r.Version__c
      FROM DocEngine_Template_Version__c
      WHERE Id = :versionId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (rows.isEmpty()) {
      throw new AuraHandledException('Template version not found.');
    }
    DocEngine_Template_Version__c ver = rows[0];
    DocEngineAccess.assertGroupAccess(ver.Template__r.Access_Group_Id__c);

    TemplateDTO dto = new TemplateDTO();
    dto.id = ver.Template__c;
    dto.name = ver.Template__r.Name;
    dto.objectApiName = ver.Template__r.Object_API_Name__c;
    dto.templateJson = ver.Template_JSON__c;
    dto.isActive = ver.Template__r.Is_Active__c;
    dto.version = ver.Version__c;
    dto.versionId = ver.Id;
    dto.description = ver.Template__r.Description__c;
    dto.pdfFilename = ver.Template__r.PDF_Filename__c;
    dto.accessGroupId = ver.Template__r.Access_Group_Id__c;
    return dto;
  }

  /**
   * Version history for the builder picker (newest first).
   */
  @AuraEnabled(cacheable=true)
  public static List<VersionSummary> listVersions(Id templateId) {
    if (templateId == null) {
      throw new AuraHandledException('templateId is required.');
    }
    DocEngineAccess.assertTemplateAccess(templateId);

    List<DocEngine_Template__c> heads = [
      SELECT Id, Current_Version__c
      FROM DocEngine_Template__c
      WHERE Id = :templateId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    Id currentId = heads.isEmpty() ? null : heads[0].Current_Version__c;

    List<VersionSummary> out = new List<VersionSummary>();
    for (DocEngine_Template_Version__c row : [
      SELECT Id, Version__c, CreatedDate, CreatedBy.Name
      FROM DocEngine_Template_Version__c
      WHERE Template__c = :templateId
      WITH SECURITY_ENFORCED
      ORDER BY Version__c DESC
      LIMIT 200
    ]) {
      VersionSummary s = new VersionSummary();
      s.id = row.Id;
      s.version = row.Version__c;
      s.createdDate = row.CreatedDate;
      s.createdByName = row.CreatedBy != null ? row.CreatedBy.Name : null;
      s.isCurrent = currentId != null && currentId == row.Id;
      out.add(s);
    }
    return out;
  }

  /**
   * Active templates for a Salesforce object type (fill-mode picker).
   * Templates with Access_Group_Id__c set are returned only to members of that Public Group
   * (users with View All Records on templates always see all).
   */
  @AuraEnabled(cacheable=true)
  public static List<TemplateSummary> listForObject(String objectApiName) {
    if (String.isBlank(objectApiName)) {
      throw new AuraHandledException('objectApiName is required.');
    }
    List<DocEngine_Template__c> rows = [
      SELECT Id, Name, Description__c, Version__c, Access_Group_Id__c
      FROM DocEngine_Template__c
      WHERE Object_API_Name__c = :objectApiName AND Is_Active__c = TRUE
      WITH SECURITY_ENFORCED
      ORDER BY Name
    ];
    List<TemplateSummary> out = new List<TemplateSummary>();
    for (DocEngine_Template__c row : rows) {
      if (!DocEngineAccess.canAccessByGroup(row.Access_Group_Id__c)) {
        continue;
      }
      TemplateSummary s = new TemplateSummary();
      s.id = row.Id;
      s.name = row.Name;
      s.description = row.Description__c;
      s.version = row.Version__c;
      out.add(s);
    }
    return out;
  }

  /**
   * Upsert template metadata and always insert a new immutable version row.
   * Opening an older version and saving creates max(Version)+1 and makes it current.
   */
  @AuraEnabled
  public static TemplateDTO saveTemplate(TemplateDTO dto) {
    if (dto == null) {
      throw new AuraHandledException('Template payload is required.');
    }
    if (String.isBlank(dto.name)) {
      throw new AuraHandledException('name is required.');
    }
    if (String.isBlank(dto.objectApiName)) {
      throw new AuraHandledException('objectApiName is required.');
    }
    if (String.isBlank(dto.templateJson)) {
      throw new AuraHandledException('templateJson is required.');
    }

    DocEngine_Template__c row = dto.id != null
      ? [
          SELECT Id, Version__c, Current_Version__c
          FROM DocEngine_Template__c
          WHERE Id = :dto.id
          WITH SECURITY_ENFORCED
          LIMIT 1
        ]
      : new DocEngine_Template__c();

    row.Name = dto.name.trim();
    row.Object_API_Name__c = dto.objectApiName.trim();
    row.Template_JSON__c = dto.templateJson;
    row.Is_Active__c = dto.isActive == null ? true : dto.isActive;
    row.Description__c = dto.description;
    row.PDF_Filename__c = dto.pdfFilename;
    row.Access_Group_Id__c = normalizeAccessGroupId(dto.accessGroupId);

    Decimal nextVersion = nextVersionNumber(row.Id, row.Version__c);
    row.Version__c = nextVersion;

    SObjectAccessDecision decision = Security.stripInaccessible(
      AccessType.UPSERTABLE,
      new List<DocEngine_Template__c>{ row }
    );
    List<DocEngine_Template__c> safe = (List<DocEngine_Template__c>) decision.getRecords();
    upsert safe;
    Id templateId = safe[0].Id;

    DocEngine_Template_Version__c ver = insertVersion(templateId, nextVersion, dto.templateJson);

    DocEngine_Template__c headPatch = new DocEngine_Template__c(
      Id = templateId,
      Current_Version__c = ver.Id,
      Version__c = nextVersion,
      Template_JSON__c = dto.templateJson
    );
    SObjectAccessDecision headDecision = Security.stripInaccessible(
      AccessType.UPDATABLE,
      new List<DocEngine_Template__c>{ headPatch }
    );
    update headDecision.getRecords();

    return getTemplate(templateId);
  }

  /**
   * Find-or-create a version row for the template's current head (lazy snapshot for documents).
   * Prefer Current_Version__c when present. Runs without sharing so fill users can pin
   * a snapshot even when they only have read access on templates.
   */
  public static Id ensureCurrentVersionId(Id templateId) {
    return DocEngineTemplateVersionService.ensureCurrentVersionId(templateId);
  }

  private static Decimal nextVersionNumber(Id templateId, Decimal headVersion) {
    if (templateId == null) {
      return 1;
    }
    AggregateResult[] aggs = [
      SELECT MAX(Version__c) maxVer
      FROM DocEngine_Template_Version__c
      WHERE Template__c = :templateId
    ];
    Decimal maxVer = aggs.isEmpty() ? null : (Decimal) aggs[0].get('maxVer');
    Decimal baseline = maxVer;
    if (baseline == null) {
      baseline = headVersion;
    } else if (headVersion != null && headVersion > baseline) {
      baseline = headVersion;
    }
    return baseline == null ? 1 : baseline + 1;
  }

  private static DocEngine_Template_Version__c insertVersion(
    Id templateId,
    Decimal versionNumber,
    String templateJson
  ) {
    return DocEngineTemplateVersionService.insertVersion(templateId, versionNumber, templateJson);
  }

  @TestVisible
  private static String versionKey(Id templateId, Decimal versionNumber) {
    return DocEngineTemplateVersionService.versionKey(templateId, versionNumber);
  }

  private static TemplateDTO toDto(DocEngine_Template__c row) {
    TemplateDTO dto = new TemplateDTO();
    dto.id = row.Id;
    dto.name = row.Name;
    dto.objectApiName = row.Object_API_Name__c;
    if (row.Current_Version__c != null && row.Current_Version__r != null
        && String.isNotBlank(row.Current_Version__r.Template_JSON__c)) {
      dto.templateJson = row.Current_Version__r.Template_JSON__c;
      dto.version = row.Current_Version__r.Version__c != null
        ? row.Current_Version__r.Version__c
        : row.Version__c;
      dto.versionId = row.Current_Version__c;
    } else {
      dto.templateJson = row.Template_JSON__c;
      dto.version = row.Version__c;
      dto.versionId = row.Current_Version__c;
    }
    dto.isActive = row.Is_Active__c;
    dto.description = row.Description__c;
    dto.pdfFilename = row.PDF_Filename__c;
    dto.accessGroupId = row.Access_Group_Id__c;
    return dto;
  }

  private static String normalizeAccessGroupId(String accessGroupId) {
    if (String.isBlank(accessGroupId)) {
      return null;
    }
    String trimmed = accessGroupId.trim();
    Id groupId;
    try {
      groupId = Id.valueOf(trimmed);
    } catch (Exception e) {
      throw new AuraHandledException('Access Public Group Id must be a valid Id.');
    }
    List<Group> groups = [
      SELECT Id
      FROM Group
      WHERE Id = :groupId AND Type = 'Regular'
      LIMIT 1
    ];
    if (groups.isEmpty()) {
      throw new AuraHandledException('Access Public Group Id must reference a Public Group.');
    }
    return String.valueOf(groups[0].Id);
  }
}
