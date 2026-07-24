@IsTest
private class DocEngineButtonControllerTest {
  @IsTest
  static void getConfigAccountGenerateDocument() {
    DocEngine_Template__c t = new DocEngine_Template__c(
      Name = 'Test template',
      Object_API_Name__c = 'Account',
      Is_Active__c = true,
      Template_JSON__c = '{"kind":"template","version":2,"fieldSchemas":{},"blocks":[]}',
      Version__c = 1
    );
    insert t;
    insert new DocEngine_Button_Config__c(
      Name = 'Account Generate Document',
      Developer_Name__c = 'Account_Generate_Document',
      Template__c = t.Id,
      Fill_Mode__c = true,
      Export_Mode__c = 'pdf',
      Show_Preview__c = true
    );

    Test.startTest();
    DocEngineButtonController.ButtonConfig cfg = DocEngineButtonController.getConfig(
      'Account_Generate_Document'
    );
    Test.stopTest();

    System.assertEquals('Account_Generate_Document', cfg.developerName);
    System.assertEquals(t.Id, cfg.templateId);
    System.assertEquals('Account', cfg.objectApiName);
    System.assertEquals(true, cfg.fillMode);
    System.assertEquals('pdf', cfg.exportMode);
    System.assertEquals(true, cfg.showPreview);
    System.assertEquals(false, cfg.hideEmpty);
    System.assertEquals(false, cfg.attachToRecord);
  }

  @IsTest
  static void getConfigForTemplateReturnsLatest() {
    DocEngine_Template__c t = new DocEngine_Template__c(
      Name = 'By Template',
      Object_API_Name__c = 'Account',
      Is_Active__c = true,
      Template_JSON__c = '{"kind":"template","version":2,"fieldSchemas":{},"blocks":[]}',
      Version__c = 1
    );
    insert t;
    insert new DocEngine_Button_Config__c(
      Name = 'account demo 3',
      Developer_Name__c = 'account demo 3',
      Template__c = t.Id,
      Fill_Mode__c = false,
      Export_Mode__c = 'html',
      Show_Preview__c = false,
      Hide_Empty__c = true,
      Attach_To_Record__c = true
    );

    Test.startTest();
    DocEngineButtonController.ButtonConfig cfg = DocEngineButtonController.getConfigForTemplate(t.Id);
    Test.stopTest();

    System.assertNotEquals(null, cfg);
    System.assertEquals('html', cfg.exportMode);
    System.assertEquals(true, cfg.attachToRecord);
    System.assertEquals(true, cfg.hideEmpty);
    System.assertEquals(false, cfg.fillMode);
  }

  @IsTest
  static void resolveTemplateById() {
    DocEngine_Template__c t = new DocEngine_Template__c(
      Name = 'By Id',
      Object_API_Name__c = 'Account',
      Is_Active__c = true,
      Template_JSON__c = '{"kind":"template","version":2,"fieldSchemas":{},"blocks":[]}',
      Version__c = 1
    );
    insert t;
    Test.startTest();
    Id tid = DocEngineButtonController.resolveTemplateId(String.valueOf(t.Id));
    Test.stopTest();
    System.assertEquals(t.Id, tid);
  }

  @IsTest
  static void getConfigMissingThrows() {
    try {
      DocEngineButtonController.getConfig('Does_Not_Exist');
      System.assert(false, 'Expected AuraHandledException');
    } catch (AuraHandledException e) {
      System.assert(e.getMessage() != null);
    }
  }
}
