# Explicit local API contract

EveryJSONsuccess/error:no-store,strictOrigin/Host;mutationsPOSTCSRF aftercurrentauth/role. 2MiBrawJSON,decodedduplicatekeys/unknownfields/types rejected,canonicalpaths/noqueryselectors. Fixed400/401/403/404/405/409/413/429/500error{code,message};no rawSQL/row/stack. HEADnoentity. Publicstatic/config no live rows. AuthcookieHttpOnly/SameSiteStrict;SecureonHTTPS. This localapp is not publicservicehardening certification.

PublicGET/config staticmetadata;POST/login{username,password};GET/session own{name,role,csrf};POST/logout{} ownsession. GET/state returnsadmin{revision,data} oroperator{packets:[publicPacket]}. GET/dispatch/:canonicalUUID returnsboundoperator{packet} oradmin{dispatch,terminal}. Unknown/foreign/withdrawn404identicalbeforeversion/globalkey checks. Noqueryfilters/publicforms/receipts/files.

POST/ack-preview{dispatchUUID,expectedVersion},onlyboundcurrentoperator,readonly{packet,canAcknowledge:true}. POST/acknowledge{dispatchUUID,expectedVersion,requestKey,note},dedicatedIMMEDIATEobjectCAS;POSTsuccesssameexplicitDTOasGET,notrawstore. noteactualtrimmed1..2000UTF16,versionpositiveJSONinteger,UUIDlowercasev4. Previewdoesnotprovehumanreading. Actor/time/content computedserver. Ownconflicts409fixed;noautomaticretry.

Adminonly:GET/POST/users (new{username,password,role},noedit/delete),GET/audit(last200),GET/backup{format,data},POST/restore{backup,revision,requestKey} emptyonly/currentroles;POST/preview readonlysimulation;POST/command actualwrite. Genericcommands allstrict{action,revision,requestKey,...exactfields}:
- template.create code/title
- template.edit templateId/title
- template.archive templateId
- section.save templateId/sectionId(nullfornew)/position/titleRu/titleKk/textRu/textKk
- section.archive templateId/sectionId
- publish templateId
- publication.archive publicationId
- dispatch publicationId/recipient/language
- withdraw dispatchUUID/expectedVersion/note
- dispatch.archive dispatchUUID(terminalonly,adminvisibility)

No-opdraft edit writesnothing/noaudit/nokeyconsumption. Successfulmeaningfulwritesappendonekey/auditatomically. Requestkeygloballyfreshacrossallcommands/IDsandJSONrestorehistory,refusedreplaynotidempotentsuccess. AdminCASglobal;operatorCASownobjectinsideIMMEDIATE,notoutsideglobalread/nestedtransaction. Currentrolecheckedagaininstore. Accountnamesnotidentity/historicalroleproof. UnsignedJSONconsistencylimitedtostructure/snapshots/keybindings/roles/time,notmaliciousrecomputedtruth.

RecursivepublicPacketonly:id/version/state(available|acknowledged)/language/issuedAt/content{title,version,sections[{position,titleRu,titleKk,textRu,textKk}]}/acknowledgement(null|{note,at}). Bothauthoredlanguagesvisibleforownpackage;languageonlydisplaychoice. NosourceIDs/globalrevision/users/audit/requestKeys/recipient/adminreason/hiddenrowcounts. Sharedtiming/availability/infrastructureisolationnotpromised.

Client:inmemoryonly;session/accessrevalidateonrefresh/visiblepageshow,noautoack;generationdropslateoldidentityresponses. Logout/401/identitychangeclearcontent/notes;withdrawkeepsonlyseparatesameaccountnote copy. Fullreloadcanlosememory. Networkwriteabort/timeoutdoesnotrollbackserver;outcomeunknown,readcanonicalstateexplicitly,noretry. Actual browser scope and limitations are in browser-proof.json; no blanket security/identity/reading claim.
