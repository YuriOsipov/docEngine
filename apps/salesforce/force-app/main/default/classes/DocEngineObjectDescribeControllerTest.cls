@IsTest
private class DocEngineObjectDescribeControllerTest {
  @IsTest
  static void listSourceObjectsIncludesAccount() {
    Test.startTest();
    List<DocEngineObjectDescribeController.ObjectOption> opts = DocEngineObjectDescribeController.listSourceObjects(
      ''
    );
    Test.stopTest();
    Boolean foundAccount = false;
    for (DocEngineObjectDescribeController.ObjectOption o : opts) {
      if (o.value == 'Account') {
        foundAccount = true;
        break;
      }
    }
    System.assert(foundAccount, 'Expected Account in source object list');
  }

  @IsTest
  static void listSourceObjectsFiltersBySearch() {
    List<DocEngineObjectDescribeController.ObjectOption> opts = DocEngineObjectDescribeController.listSourceObjects(
      'Account'
    );
    System.assert(opts.size() >= 1);
    for (DocEngineObjectDescribeController.ObjectOption o : opts) {
      System.assert(
        o.label.toLowerCase().contains('account') || o.value.toLowerCase().contains('account')
      );
    }
  }

  @IsTest
  static void buildSourceSampleJsonForAccount() {
    Test.startTest();
    String json = DocEngineObjectDescribeController.buildSourceSampleJson('Account');
    Test.stopTest();
    System.assert(String.isNotBlank(json));
    Map<String, Object> sample = (Map<String, Object>) System.JSON.deserializeUntyped(json);
    System.assert(sample.containsKey('Id'));
    System.assert(sample.containsKey('Name') || sample.size() > 1);
  }

  @IsTest
  static void buildSourceSampleJsonIncludesParentLookups() {
    Test.startTest();
    String json = DocEngineObjectDescribeController.buildSourceSampleJson('Account');
    Test.stopTest();
    Map<String, Object> sample = (Map<String, Object>) System.JSON.deserializeUntyped(json);
    System.assert(
      sample.containsKey('Owner'),
      'Expected nested Owner relationship for Account.OwnerId'
    );
    Object ownerObj = sample.get('Owner');
    System.assert(ownerObj instanceof Map<String, Object>, 'Owner should be a nested object');
    Map<String, Object> owner = (Map<String, Object>) ownerObj;
    System.assertEquals(
      true,
      owner.get('__lazy'),
      'Owner should be a lazy stub until expanded'
    );
  }

  @IsTest
  static void buildSourceSampleJsonIncludesChildRelationships() {
    Test.startTest();
    String json = DocEngineObjectDescribeController.buildSourceSampleJson('Account');
    Test.stopTest();
    Map<String, Object> sample = (Map<String, Object>) System.JSON.deserializeUntyped(json);
    Boolean foundChildStub = false;
    for (String key : sample.keySet()) {
      Object val = sample.get(key);
      if (val instanceof List<Object>) {
        List<Object> rows = (List<Object>) val;
        if (
          !rows.isEmpty() &&
          rows[0] instanceof Map<String, Object> &&
          ((Map<String, Object>) rows[0]).get('__lazy') == true
        ) {
          foundChildStub = true;
          break;
        }
      }
    }
    System.assert(
      foundChildStub,
      'Expected at least one lazy child relationship stub (e.g. Contacts)'
    );
  }

  @IsTest
  static void buildRelatedSampleJsonExpandsOwner() {
    Test.startTest();
    String json = DocEngineObjectDescribeController.buildRelatedSampleJson('Account', 'Owner');
    Test.stopTest();
    Map<String, Object> owner = (Map<String, Object>) System.JSON.deserializeUntyped(json);
    System.assert(owner.containsKey('Id'), 'Expanded Owner should include Id');
    System.assert(
      owner.get('__lazy') != true,
      'Expanded Owner must not remain a lazy stub'
    );
    System.assert(
      owner.containsKey('Name') || owner.size() > 1,
      'Expanded Owner should include sample fields'
    );
  }

  @IsTest
  static void buildRelatedSampleJsonExpandsChildContacts() {
    Test.startTest();
    String json = DocEngineObjectDescribeController.buildRelatedSampleJson('Account', 'Contacts');
    Test.stopTest();
    List<Object> rows = (List<Object>) System.JSON.deserializeUntyped(json);
    System.assert(!rows.isEmpty(), 'Contacts should expand to a sample array');
    Map<String, Object> row = (Map<String, Object>) rows[0];
    System.assert(row.containsKey('Id'));
    System.assert(row.get('__lazy') != true);
    // Nested parent on the child row should remain a lazy stub
    if (row.containsKey('Account')) {
      Map<String, Object> acct = (Map<String, Object>) row.get('Account');
      System.assertEquals(true, acct.get('__lazy'), 'Nested Account on Contact should be lazy');
    }
  }

  @IsTest
  static void buildRelatedSampleJsonExpandsNestedParentOnChild() {
    Test.startTest();
    String json = DocEngineObjectDescribeController.buildRelatedSampleJson(
      'Account',
      'Contacts.Account'
    );
    Test.stopTest();
    Map<String, Object> acct = (Map<String, Object>) System.JSON.deserializeUntyped(json);
    System.assert(acct.containsKey('Id'), 'Nested Account expand should include Id');
    System.assert(acct.get('__lazy') != true, 'Expanded nested Account must not stay lazy');
  }

  @IsTest
  static void buildSourceSampleJsonRequiresObject() {
    Boolean threw = false;
    try {
      DocEngineObjectDescribeController.buildSourceSampleJson('');
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'Expected AuraHandledException for blank object');
  }

  @IsTest
  static void listRemoteCollectionsForAccount() {
    Test.startTest();
    List<DocEngineObjectDescribeController.RemoteCollectionNode> nodes = DocEngineObjectDescribeController.listRemoteCollections(
      'Account'
    );
    Test.stopTest();
    System.assert(nodes.size() >= 1, 'Expected at least Account (Name search)');
    System.assertEquals('Account', nodes[0].collectionId);
    Boolean foundIndustry = false;
    for (DocEngineObjectDescribeController.RemoteCollectionNode n : nodes) {
      if (n.collectionId == 'Account.Industry') {
        foundIndustry = true;
        break;
      }
    }
    System.assert(foundIndustry, 'Expected Account.Industry picklist collection');
  }

  @IsTest
  static void listRemoteLabelFieldsForObjectAndPicklist() {
    List<DocEngineObjectDescribeController.RemoteLabelField> objFields = DocEngineObjectDescribeController.listRemoteLabelFields(
      'Account'
    );
    System.assert(objFields.size() >= 1);
    System.assertEquals('Name', objFields[0].id);

    List<DocEngineObjectDescribeController.RemoteLabelField> pickFields = DocEngineObjectDescribeController.listRemoteLabelFields(
      'Account.Industry'
    );
    System.assertEquals(2, pickFields.size());
  }
}
