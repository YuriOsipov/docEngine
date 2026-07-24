/**
 * Source-object picker + mapping/remote-list helpers for DocEngine templates.
 */
public with sharing class DocEngineObjectDescribeController {
  public class ObjectOption implements Comparable {
    @AuraEnabled public String label;
    @AuraEnabled public String value;
    @AuraEnabled public String apiName;

    public Integer compareTo(Object other) {
      ObjectOption o = (ObjectOption) other;
      if (label == o.label) {
        return 0;
      }
      if (label == null) {
        return 1;
      }
      if (o.label == null) {
        return -1;
      }
      return label.toLowerCase().compareTo(o.label.toLowerCase());
    }
  }

  public class RemoteCollectionNode implements Comparable {
    @AuraEnabled public String id;
    @AuraEnabled public String label;
    @AuraEnabled public String kind;
    @AuraEnabled public String collectionId;

    public Integer compareTo(Object other) {
      RemoteCollectionNode o = (RemoteCollectionNode) other;
      if (label == o.label) {
        return 0;
      }
      if (label == null) {
        return 1;
      }
      if (o.label == null) {
        return -1;
      }
      return label.toLowerCase().compareTo(o.label.toLowerCase());
    }
  }

  public class RemoteLabelField {
    @AuraEnabled public String id;
    @AuraEnabled public String label;
  }

  /**
   * Createable, queryable objects suitable as a document data source.
   */
  @AuraEnabled(cacheable=true)
  public static List<ObjectOption> listSourceObjects(String searchTerm) {
    String q = String.isBlank(searchTerm) ? '' : searchTerm.trim().toLowerCase();
    List<ObjectOption> preferred = new List<ObjectOption>();
    List<ObjectOption> custom = new List<ObjectOption>();
    List<ObjectOption> other = new List<ObjectOption>();

    Set<String> preferredNames = new Set<String>{
      'Account',
      'Contact',
      'Opportunity',
      'Lead',
      'Case',
      'Contract',
      'Order',
      'Product2',
      'Quote'
    };

    for (Schema.SObjectType t : Schema.getGlobalDescribe().values()) {
      Schema.DescribeSObjectResult d = t.getDescribe();
      if (!d.isAccessible() || !d.isCreateable() || !d.isQueryable()) {
        continue;
      }
      String api = d.getName();
      if (
        api.endsWith('__Share') ||
        api.endsWith('__History') ||
        api.endsWith('__Feed') ||
        api.endsWith('__ChangeEvent') ||
        api.endsWith('__OwnerSharingRule') ||
        api.startsWith('Apex') ||
        api == 'User' ||
        api == 'Group'
      ) {
        continue;
      }
      if (api.endsWith('__mdt') || api.endsWith('__e')) {
        continue;
      }

      String label = d.getLabel();
      if (String.isNotBlank(q) &&
          !label.toLowerCase().contains(q) &&
          !api.toLowerCase().contains(q)) {
        continue;
      }

      ObjectOption opt = new ObjectOption();
      opt.label = label + ' (' + api + ')';
      opt.value = api;
      opt.apiName = api;

      if (preferredNames.contains(api)) {
        preferred.add(opt);
      } else if (d.isCustom()) {
        custom.add(opt);
      } else {
        other.add(opt);
      }
    }

    preferred.sort();
    custom.sort();
    List<ObjectOption> out = new List<ObjectOption>();
    out.addAll(preferred);
    out.addAll(custom);
    Integer room = 200 - out.size();
    if (room > 0) {
      other.sort();
      for (Integer i = 0; i < other.size() && i < room; i++) {
        out.add(other[i]);
      }
    }
    return out;
  }

  /** ERP objects (e.g. GFERP Sales Order) often exceed 50 fields — keep a high cap. */
  private static final Integer MAX_ROOT_FIELDS = 250;
  private static final Integer MAX_PARENT_RELATIONSHIPS = 40;
  private static final Integer MAX_RELATED_FIELDS = 80;
  private static final Integer MAX_CHILD_RELATIONSHIPS = 40;
  private static final Integer MAX_CHILD_FIELDS = 80;
  /** Marker key so Field Mapping UI can show an expandable stub before lazy load. */
  @TestVisible
  private static final String LAZY_MARKER = '__lazy';

  /**
   * Sample source JSON for Field Mapping UI (paths match DocEngineMergeController.buildPayload).
   * Root fields are fully described; parent lookups and child relationships are
   * lazy stubs ({ "__lazy": true }) expanded on demand via buildRelatedSampleJson.
   */
  @AuraEnabled(cacheable=true)
  public static String buildSourceSampleJson(String objectApiName) {
    if (String.isBlank(objectApiName)) {
      throw new AuraHandledException('objectApiName is required.');
    }
    Schema.SObjectType t = Schema.getGlobalDescribe().get(objectApiName);
    if (t == null) {
      throw new AuraHandledException('Unknown object: ' + objectApiName);
    }
    Schema.DescribeSObjectResult d = t.getDescribe();
    if (!d.isAccessible() || !d.isQueryable()) {
      throw new AuraHandledException('Object is not accessible: ' + objectApiName);
    }

    Map<String, Object> sample = new Map<String, Object>();
    sample.put('Id', '001000000000000AAA');

    List<String> fieldNames = new List<String>(d.fields.getMap().keySet());
    fieldNames.sort();

    Integer fieldCount = 0;
    Integer parentCount = 0;
    for (String fieldName : fieldNames) {
      Schema.DescribeFieldResult fd = d.fields.getMap().get(fieldName).getDescribe();
      if (!fd.isAccessible()) {
        continue;
      }
      String name = fd.getName();
      if (name == 'Id') {
        continue;
      }
      Schema.DisplayType dt = fd.getType();

      if (dt == Schema.DisplayType.ADDRESS) {
        if (fieldCount < MAX_ROOT_FIELDS && !sample.containsKey(name)) {
          sample.put(name, buildAddressSample(name));
          fieldCount += 1;
        }
        continue;
      }

      if (isSkippedSampleType(dt)) {
        continue;
      }

      if (fieldCount < MAX_ROOT_FIELDS) {
        sample.put(name, sampleValueFor(fd));
        fieldCount += 1;
      }

      // Parent lookups as lazy stubs — expand via buildRelatedSampleJson
      if (
        dt == Schema.DisplayType.REFERENCE &&
        parentCount < MAX_PARENT_RELATIONSHIPS
      ) {
        String relName = fd.getRelationshipName();
        if (String.isNotBlank(relName) && !sample.containsKey(relName)) {
          sample.put(relName, lazyStub('parent'));
          parentCount += 1;
        }
      }
    }

    addChildRelationshipStubs(d, sample);

    return JSON.serializePretty(sample);
  }

  /**
   * Expand a parent lookup or child relationship path into a full sample branch.
   * relationshipPath examples: "Owner", "Contacts", "GFERP__Sales_Order_Lines__r",
   * "Owner.Manager" (parent chain). Optional "$payload." prefix is stripped.
   */
  @AuraEnabled(cacheable=true)
  public static String buildRelatedSampleJson(String objectApiName, String relationshipPath) {
    if (String.isBlank(objectApiName)) {
      throw new AuraHandledException('objectApiName is required.');
    }
    if (String.isBlank(relationshipPath)) {
      throw new AuraHandledException('relationshipPath is required.');
    }

    String path = relationshipPath.trim();
    if (path.startsWith('$payload.')) {
      path = path.substring('$payload.'.length());
    } else if (path == '$payload') {
      throw new AuraHandledException('Expand a related path, not $payload itself.');
    }
    // Ignore array indexes from tree paths like Lines__r[0]
    path = path.replaceAll('\\[\\d+\\]', '');

    Schema.SObjectType rootType = Schema.getGlobalDescribe().get(objectApiName);
    if (rootType == null) {
      throw new AuraHandledException('Unknown object: ' + objectApiName);
    }

    List<String> parts = path.split('\\.');
    if (parts.isEmpty() || String.isBlank(parts[0])) {
      throw new AuraHandledException('Invalid relationshipPath: ' + relationshipPath);
    }

    Schema.DescribeSObjectResult current = rootType.getDescribe();
    for (Integer i = 0; i < parts.size() - 1; i++) {
      Schema.DescribeSObjectResult next = resolveParentDescribe(current, parts[i]);
      if (next == null) {
        next = resolveChildDescribe(current, parts[i]);
      }
      if (next == null) {
        throw new AuraHandledException(
          'Cannot navigate relationship "' + parts[i] + '" on ' + current.getName()
        );
      }
      current = next;
    }

    String last = parts[parts.size() - 1];
    Object branch = buildRelationshipBranch(current, last);
    if (branch == null) {
      throw new AuraHandledException(
        'Unknown relationship "' + last + '" on ' + current.getName()
      );
    }
    return JSON.serializePretty(branch);
  }

  private static Map<String, Object> lazyStub(String kind) {
    Map<String, Object> stub = new Map<String, Object>();
    stub.put(LAZY_MARKER, true);
    stub.put('__kind', kind);
    stub.put('_', 'Expand to load fields');
    return stub;
  }

  /**
   * Child relationships as lazy array stubs: [ { __lazy: true } ].
   */
  private static void addChildRelationshipStubs(
    Schema.DescribeSObjectResult parentDescribe,
    Map<String, Object> sample
  ) {
    Integer childCount = 0;
    Map<String, Schema.ChildRelationship> byName = new Map<String, Schema.ChildRelationship>();
    for (Schema.ChildRelationship cr : parentDescribe.getChildRelationships()) {
      String relName = cr.getRelationshipName();
      if (String.isBlank(relName) || sample.containsKey(relName)) {
        continue;
      }
      byName.put(relName, cr);
    }
    List<String> relNames = new List<String>(byName.keySet());
    relNames.sort();

    for (String relName : relNames) {
      if (childCount >= MAX_CHILD_RELATIONSHIPS) {
        break;
      }
      Schema.ChildRelationship cr = byName.get(relName);
      Schema.SObjectType childType = cr.getChildSObject();
      if (childType == null) {
        continue;
      }
      Schema.DescribeSObjectResult childDescribe = childType.getDescribe();
      if (
        !childDescribe.isAccessible() ||
        !childDescribe.isQueryable() ||
        isSkippedChildObject(childDescribe.getName())
      ) {
        continue;
      }
      sample.put(relName, new List<Object>{ lazyStub('child') });
      childCount += 1;
    }
  }

  private static Schema.DescribeSObjectResult resolveParentDescribe(
    Schema.DescribeSObjectResult current,
    String relationshipName
  ) {
    for (Schema.SObjectField f : current.fields.getMap().values()) {
      Schema.DescribeFieldResult fd = f.getDescribe();
      if (fd.getRelationshipName() == relationshipName) {
        List<Schema.SObjectType> refs = fd.getReferenceTo();
        if (refs != null && !refs.isEmpty()) {
          return refs[0].getDescribe();
        }
      }
    }
    return null;
  }

  private static Schema.DescribeSObjectResult resolveChildDescribe(
    Schema.DescribeSObjectResult current,
    String relationshipName
  ) {
    for (Schema.ChildRelationship cr : current.getChildRelationships()) {
      if (cr.getRelationshipName() == relationshipName) {
        Schema.SObjectType childType = cr.getChildSObject();
        return childType == null ? null : childType.getDescribe();
      }
    }
    return null;
  }

  private static Object buildRelationshipBranch(
    Schema.DescribeSObjectResult current,
    String relationshipName
  ) {
    // Parent lookup
    for (Schema.SObjectField f : current.fields.getMap().values()) {
      Schema.DescribeFieldResult fd = f.getDescribe();
      if (fd.getRelationshipName() == relationshipName) {
        Map<String, Object> related = buildRelatedSample(fd);
        if (related == null) {
          return null;
        }
        Schema.DescribeSObjectResult relatedDescribe = fd.getReferenceTo()[0].getDescribe();
        addParentLazyStubs(relatedDescribe, related);
        addChildRelationshipStubs(relatedDescribe, related);
        return related;
      }
    }
    // Child relationship
    for (Schema.ChildRelationship cr : current.getChildRelationships()) {
      if (cr.getRelationshipName() != relationshipName) {
        continue;
      }
      Schema.DescribeSObjectResult childDescribe = cr.getChildSObject().getDescribe();
      if (!childDescribe.isAccessible() || !childDescribe.isQueryable()) {
        return null;
      }
      Map<String, Object> row = buildChildRowSample(childDescribe);
      addParentLazyStubs(childDescribe, row);
      addChildRelationshipStubs(childDescribe, row);
      return new List<Object>{ row };
    }
    return null;
  }

  private static void addParentLazyStubs(
    Schema.DescribeSObjectResult describe,
    Map<String, Object> sample
  ) {
    Integer parentCount = 0;
    List<String> fieldNames = new List<String>(describe.fields.getMap().keySet());
    fieldNames.sort();
    for (String fieldName : fieldNames) {
      if (parentCount >= MAX_PARENT_RELATIONSHIPS) {
        break;
      }
      Schema.DescribeFieldResult fd = describe.fields.getMap().get(fieldName).getDescribe();
      if (!fd.isAccessible() || fd.getType() != Schema.DisplayType.REFERENCE) {
        continue;
      }
      String relName = fd.getRelationshipName();
      if (String.isBlank(relName) || sample.containsKey(relName)) {
        continue;
      }
      sample.put(relName, lazyStub('parent'));
      parentCount += 1;
    }
  }

  private static Boolean isSkippedChildObject(String api) {
    return (
      api.endsWith('__History') ||
      api.endsWith('__Share') ||
      api.endsWith('__Feed') ||
      api.endsWith('__ChangeEvent') ||
      api.endsWith('__Tag') ||
      api.endsWith('__hd') ||
      api == 'ActivityHistory' ||
      api == 'OpenActivity' ||
      api == 'CombinedAttachment' ||
      api == 'AttachedContentDocument' ||
      api == 'AttachedContentNote' ||
      api == 'EmailStatus' ||
      api == 'ProcessInstanceHistory' ||
      api == 'ContentDocumentLink' ||
      api == 'EntitySubscription' ||
      api == 'TopicAssignment'
    );
  }

  private static Map<String, Object> buildChildRowSample(Schema.DescribeSObjectResult childDescribe) {
    Map<String, Object> row = new Map<String, Object>();
    row.put('Id', 'a00000000000000AAA');
    List<String> names = new List<String>(childDescribe.fields.getMap().keySet());
    names.sort();
    Integer count = 0;
    for (String fieldName : names) {
      if (count >= MAX_CHILD_FIELDS) {
        break;
      }
      Schema.DescribeFieldResult fd = childDescribe.fields.getMap().get(fieldName).getDescribe();
      if (!fd.isAccessible()) {
        continue;
      }
      String name = fd.getName();
      if (name == 'Id' || row.containsKey(name)) {
        continue;
      }
      Schema.DisplayType dt = fd.getType();
      if (dt == Schema.DisplayType.ADDRESS) {
        row.put(name, buildAddressSample(name));
        count += 1;
        continue;
      }
      if (dt == Schema.DisplayType.REFERENCE || isSkippedSampleType(dt)) {
        // Include lookup Ids as scalars so line FKs are visible; nesting via lazy stubs
        if (dt == Schema.DisplayType.REFERENCE) {
          row.put(name, sampleValueFor(fd));
          count += 1;
        }
        continue;
      }
      row.put(name, sampleValueFor(fd));
      count += 1;
    }
    return row;
  }

  /** Placeholder compound address for Field Mapping discovery. */
  private static Map<String, Object> buildAddressSample(String fieldApiName) {
    String prefix = fieldApiName;
    if (prefix.endsWith('Address')) {
      prefix = prefix.substring(0, prefix.length() - 'Address'.length());
    }
    Map<String, Object> addr = new Map<String, Object>();
    addr.put('street', 'Sample ' + prefix + ' Street');
    addr.put('city', 'Sample ' + prefix + ' City');
    addr.put('state', 'CA');
    addr.put('postalCode', '90001');
    addr.put('country', 'US');
    return addr;
  }

  /**
   * Remote list collections for a Source Object: the object itself (Name search)
   * plus each accessible picklist field (Object.Field).
   */
  @AuraEnabled(cacheable=true)
  public static List<RemoteCollectionNode> listRemoteCollections(String objectApiName) {
    List<RemoteCollectionNode> out = new List<RemoteCollectionNode>();
    if (String.isBlank(objectApiName)) {
      return out;
    }
    Schema.SObjectType t = Schema.getGlobalDescribe().get(objectApiName);
    if (t == null) {
      return out;
    }
    Schema.DescribeSObjectResult d = t.getDescribe();
    if (!d.isAccessible()) {
      return out;
    }

    RemoteCollectionNode records = new RemoteCollectionNode();
    records.id = objectApiName;
    records.label = d.getLabel() + ' (search by Name)';
    records.kind = 'collection';
    records.collectionId = objectApiName;
    out.add(records);

    List<RemoteCollectionNode> picklists = new List<RemoteCollectionNode>();
    for (Schema.SObjectField f : d.fields.getMap().values()) {
      Schema.DescribeFieldResult fd = f.getDescribe();
      if (!fd.isAccessible()) {
        continue;
      }
      if (
        fd.getType() != Schema.DisplayType.PICKLIST &&
        fd.getType() != Schema.DisplayType.MULTIPICKLIST
      ) {
        continue;
      }
      String collId = objectApiName + '.' + fd.getName();
      RemoteCollectionNode node = new RemoteCollectionNode();
      node.id = collId;
      node.label = fd.getLabel() + ' (picklist)';
      node.kind = 'collection';
      node.collectionId = collId;
      picklists.add(node);
    }
    picklists.sort();
    out.addAll(picklists);
    return out;
  }

  @AuraEnabled(cacheable=true)
  public static List<RemoteLabelField> listRemoteLabelFields(String collectionId) {
    List<RemoteLabelField> out = new List<RemoteLabelField>();
    if (String.isBlank(collectionId)) {
      return out;
    }
    // Picklist collection — label is the picklist entry itself
    if (collectionId.contains('.')) {
      RemoteLabelField label = new RemoteLabelField();
      label.id = 'label';
      label.label = 'Picklist label';
      out.add(label);
      RemoteLabelField value = new RemoteLabelField();
      value.id = 'value';
      value.label = 'Picklist value';
      out.add(value);
      return out;
    }

    Schema.SObjectType t = Schema.getGlobalDescribe().get(collectionId);
    if (t == null) {
      return out;
    }
    Map<String, Schema.SObjectField> fields = t.getDescribe().fields.getMap();
    for (String candidate : new List<String>{ 'Name', 'Subject', 'Title', 'CaseNumber' }) {
      if (fields.containsKey(candidate) && fields.get(candidate).getDescribe().isAccessible()) {
        RemoteLabelField lf = new RemoteLabelField();
        lf.id = candidate;
        lf.label = fields.get(candidate).getDescribe().getLabel();
        out.add(lf);
      }
    }
    return out;
  }

  private static Boolean isSkippedSampleType(Schema.DisplayType dt) {
    return (
      dt == Schema.DisplayType.BASE64 ||
      dt == Schema.DisplayType.ENCRYPTEDSTRING ||
      // ADDRESS is handled explicitly in buildSourceSampleJson
      dt == Schema.DisplayType.LOCATION
    );
  }

  /**
   * One-level parent sample for a REFERENCE field. Prefer common label fields,
   * then fill remaining slots from accessible describe fields.
   */
  private static Map<String, Object> buildRelatedSample(Schema.DescribeFieldResult fd) {
    List<Schema.SObjectType> refs = fd.getReferenceTo();
    if (refs == null || refs.isEmpty()) {
      return null;
    }
    Schema.DescribeSObjectResult rd = refs[0].getDescribe();
    if (!rd.isAccessible()) {
      return null;
    }

    Map<String, Object> nested = new Map<String, Object>();
    nested.put('Id', '001000000000000AAA');
    Map<String, Schema.SObjectField> fieldMap = rd.fields.getMap();
    Integer count = 0;

    for (
      String candidate : new List<String>{
        'Name',
        'FirstName',
        'LastName',
        'Subject',
        'Title',
        'CaseNumber',
        'Email',
        'Phone',
        'Username'
      }
    ) {
      if (count >= MAX_RELATED_FIELDS) {
        break;
      }
      if (!fieldMap.containsKey(candidate)) {
        continue;
      }
      Schema.DescribeFieldResult cfd = fieldMap.get(candidate).getDescribe();
      if (!cfd.isAccessible() || isSkippedSampleType(cfd.getType())) {
        continue;
      }
      nested.put(candidate, sampleValueFor(cfd));
      count += 1;
    }

    for (Schema.SObjectField rf : fieldMap.values()) {
      if (count >= MAX_RELATED_FIELDS) {
        break;
      }
      Schema.DescribeFieldResult rfd = rf.getDescribe();
      if (!rfd.isAccessible()) {
        continue;
      }
      String name = rfd.getName();
      if (name == 'Id' || nested.containsKey(name)) {
        continue;
      }
      Schema.DisplayType rdt = rfd.getType();
      if (rdt == Schema.DisplayType.ADDRESS) {
        nested.put(name, buildAddressSample(name));
        count += 1;
        continue;
      }
      // Lookups become lazy stubs via addParentLazyStubs — skip inlining here
      if (rdt == Schema.DisplayType.REFERENCE || isSkippedSampleType(rdt)) {
        continue;
      }
      nested.put(name, sampleValueFor(rfd));
      count += 1;
    }

    return nested;
  }

  private static Object sampleValueFor(Schema.DescribeFieldResult fd) {
    Schema.DisplayType dt = fd.getType();
    if (dt == Schema.DisplayType.BOOLEAN) {
      return false;
    }
    if (
      dt == Schema.DisplayType.CURRENCY ||
      dt == Schema.DisplayType.DOUBLE ||
      dt == Schema.DisplayType.PERCENT ||
      dt == Schema.DisplayType.INTEGER ||
      dt == Schema.DisplayType.LONG
    ) {
      return 0;
    }
    if (dt == Schema.DisplayType.DATE) {
      return String.valueOf(Date.today());
    }
    if (dt == Schema.DisplayType.DATETIME) {
      return String.valueOf(Datetime.now());
    }
    if (dt == Schema.DisplayType.PICKLIST || dt == Schema.DisplayType.MULTIPICKLIST) {
      List<Schema.PicklistEntry> entries = fd.getPicklistValues();
      if (!entries.isEmpty()) {
        return entries[0].getValue();
      }
      return '';
    }
    if (dt == Schema.DisplayType.REFERENCE) {
      return '001000000000000AAA';
    }
    String label = fd.getLabel();
    return 'Sample ' + (String.isBlank(label) ? fd.getName() : label);
  }
}
