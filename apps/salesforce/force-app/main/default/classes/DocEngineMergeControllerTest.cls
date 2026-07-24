@IsTest
private class DocEngineMergeControllerTest {
  @IsTest
  static void buildPayloadFromAccount() {
    Account a = new Account(Name = 'Acme Corp', Industry = 'Technology');
    insert a;

    DocEngine_Template__c t = new DocEngine_Template__c(
      Name = 'T',
      Object_API_Name__c = 'Account',
      Template_JSON__c =
        '{"kind":"template","fieldMapping":{"kind":"fieldMapping","version":1,"rules":[{"section":"main","field":"name","sourcePath":"Name"},{"section":"main","field":"ind","sourcePath":"$payload.Industry"}]}}',
      Is_Active__c = true,
      Version__c = 1
    );
    insert t;

    Test.startTest();
    Map<String, Object> payload = DocEngineMergeController.buildPayload(a.Id, t.Id, null);
    Test.stopTest();

    System.assertEquals(a.Id, payload.get('Id'));
    System.assertEquals('Acme Corp', payload.get('Name'));
    System.assertEquals('Technology', payload.get('Industry'));
  }

  @IsTest
  static void collectSourceFieldPathsFromV1Rules() {
    Set<String> paths = DocEngineMergeController.collectSourceFieldPaths(
      '{"kind":"fieldMapping","rules":[{"sourcePath":"$payload.Name"},{"sourcePath":"Industry"},{"sourcePath":"Bad[0]"}]}'
    );
    System.assert(paths.contains('Name'));
    System.assert(paths.contains('Industry'));
    System.assert(!paths.contains('Bad[0]'));
  }

  @IsTest
  static void collectSourceFieldPathsFromV2Sections() {
    String json =
      '{' +
      '"kind":"field",' +
      '"version":2,' +
      '"sections":{' +
      '"Header":{"Order Number":"$payload.Name"},' +
      '"Addresses":{"Shipping Address":"$payload.BillingStreet"},' +
      '"Products":{"Line Items":[{"unitPrice":"$payload.Contacts.Title","model":"$payload.Contacts.Account.Name"}]}' +
      '}' +
      '}';
    Set<String> paths = DocEngineMergeController.collectSourceFieldPaths(json);
    System.assert(paths.contains('Name'), 'Expected Name');
    System.assert(paths.contains('BillingStreet'), 'Expected BillingStreet');
    System.assert(paths.contains('Contacts.Title'), 'Expected Contacts.Title');
    System.assert(
      paths.contains('Contacts.Account.Name'),
      'Expected nested child→parent path Contacts.Account.Name'
    );
  }

  @IsTest
  static void extractFieldMappingJsonFromTemplate() {
    String templateJson =
      '{"kind":"template","fieldMapping":{"kind":"fieldMapping","version":1,"rules":[{"sourcePath":"$payload.Name"}]}}';
    String mappingJson = DocEngineMergeController.extractFieldMappingJson(templateJson);
    System.assertNotEquals(null, mappingJson);
    Set<String> paths = DocEngineMergeController.collectSourceFieldPaths(mappingJson);
    System.assert(paths.contains('Name'));
  }

  @IsTest
  static void buildPayloadFromV2SectionsWithParentPath() {
    Account a = new Account(Name = 'Acme Corp', Industry = 'Technology');
    insert a;

    DocEngine_Template__c t = new DocEngine_Template__c(
      Name = 'TV2',
      Object_API_Name__c = 'Account',
      Template_JSON__c =
        '{"kind":"template","fieldMapping":{"kind":"field","version":2,"sections":{"Header":{"Order Number":"$payload.Name","Industry":"$payload.Industry","OwnerName":"$payload.Owner.Name"}}}}',
      Is_Active__c = true,
      Version__c = 1
    );
    insert t;

    Test.startTest();
    Map<String, Object> payload = DocEngineMergeController.buildPayload(a.Id, t.Id, null);
    Test.stopTest();

    System.assertEquals('Acme Corp', payload.get('Name'));
    System.assertEquals('Technology', payload.get('Industry'));
    System.assert(payload.containsKey('Owner'), 'Owner relationship should be nested');
    Map<String, Object> owner = (Map<String, Object>) payload.get('Owner');
    System.assertNotEquals(null, owner.get('Name'), 'Owner.Name should be populated');
  }

  @IsTest
  static void buildPayloadIncludesChildSubqueryFields() {
    Account a = new Account(Name = 'Parent Acct');
    insert a;
    Contact c = new Contact(LastName = 'Line', AccountId = a.Id, Title = 'Buyer');
    insert c;

    DocEngine_Template__c t = new DocEngine_Template__c(
      Name = 'TChild',
      Object_API_Name__c = 'Account',
      Template_JSON__c =
        '{"kind":"template","fieldMapping":{"kind":"field","version":2,"sections":{"Products":{"Line Items":[{"title":"$payload.Contacts.Title","name":"$payload.Contacts.LastName"}]}}}}',
      Is_Active__c = true,
      Version__c = 1
    );
    insert t;

    Test.startTest();
    Map<String, Object> payload = DocEngineMergeController.buildPayload(a.Id, t.Id, null);
    Test.stopTest();

    System.assert(payload.containsKey('Contacts'), 'Contacts child array expected');
    List<Object> contacts = (List<Object>) payload.get('Contacts');
    System.assert(!contacts.isEmpty(), 'Expected at least one contact row');
    Map<String, Object> row;
    for (Object item : contacts) {
      Map<String, Object> candidate = (Map<String, Object>) item;
      if (candidate.get('LastName') == 'Line') {
        row = candidate;
        break;
      }
    }
    System.assertNotEquals(null, row, 'Expected contact LastName=Line in payload');
    System.assertEquals(c.Id, row.get('Id'), 'Contact Id should be present');
    System.assertEquals('Line', row.get('LastName'), 'LastName from subquery');
  }
}
