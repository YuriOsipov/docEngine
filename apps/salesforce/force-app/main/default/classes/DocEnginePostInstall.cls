/**
 * Runs on managed package install / upgrade.
 * Seeds org-default DocEngine Settings (Use External PDF = false) when missing.
 */
global without sharing class DocEnginePostInstall implements InstallHandler {
  global void onInstall(InstallContext context) {
    DocEngine_Settings__c settings = DocEngine_Settings__c.getOrgDefaults();
    if (settings.Id == null) {
      settings.Use_External_PDF__c = false;
      upsert settings;
    }
  }
}
