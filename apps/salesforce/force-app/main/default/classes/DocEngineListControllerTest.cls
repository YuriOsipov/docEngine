@IsTest
private class DocEngineListControllerTest {
  @IsTest
  static void resolvePicklistIndustry() {
    Test.startTest();
    List<DocEngineListController.ListItem> items = DocEngineListController.resolveListItems(
      'Account.Industry',
      '',
      null
    );
    Test.stopTest();
    System.assert(items.size() > 0, 'Expected Industry picklist values');
    System.assertNotEquals(null, items[0].label);
  }

  @IsTest
  static void resolveViaSourceCollection() {
    Test.startTest();
    List<DocEngineListController.ListItem> items = DocEngineListController.resolveListItems(
      'Industry',
      '',
      'Account.Industry'
    );
    Test.stopTest();
    System.assert(items.size() > 0, 'sourceCollection should resolve picklist');
  }

  @IsTest
  static void searchAccountsByName() {
    insert new Account(Name = 'DocEngine Search Target');
    Test.startTest();
    List<DocEngineListController.ListItem> items = DocEngineListController.resolveListItems(
      'Account',
      'DocEngine',
      null
    );
    Test.stopTest();
    System.assert(items.size() >= 1);
    System.assert(items[0].label.contains('DocEngine'));
  }

  @IsTest
  static void searchAccountsPrefersPrefix() {
    // Crowding ASC-only LIMIT with Brad* must not hide Brandy (DESC merge).
    List<Account> crowd = new List<Account>();
    for (Integer i = 0; i < 60; i++) {
      crowd.add(new Account(Name = 'Brad Test ' + String.valueOf(i).leftPad(3, '0')));
    }
    crowd.add(new Account(Name = 'Brandy Merryman'));
    insert crowd;
    Test.startTest();
    List<DocEngineListController.ListItem> items = DocEngineListController.resolveListItems(
      'list',
      'Bra',
      'Account'
    );
    Test.stopTest();
    System.assert(items.size() >= 1, 'Expected Brandy via Account sourceCollection');
    Boolean found = false;
    for (DocEngineListController.ListItem item : items) {
      if (item.label != null && item.label.contains('Brandy')) {
        found = true;
        break;
      }
    }
    System.assert(found, 'Expected Brandy Merryman in results (ASC+DESC prefix merge)');
  }

  @IsTest
  static void unknownCollectionThrows() {
    try {
      DocEngineListController.resolveListItems('list', 'Bra', null);
      System.assert(false, 'Expected AuraHandledException');
    } catch (AuraHandledException e) {
      System.assert(e.getMessage() != null);
    }
  }

  @IsTest
  static void blankFieldNameReturnsEmpty() {
    System.assertEquals(0, DocEngineListController.resolveListItems('', 'x', null).size());
    System.assertEquals(0, DocEngineListController.resolveListItems(null, 'x', null).size());
  }
}
