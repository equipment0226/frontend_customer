import {renderPortal} from '/shared/react-ui.js';
import {api,logout,session,download} from '/shared/api.js';
import {list,notify,errorPanel} from '/shared/ui.js';
import {openBatchUpload} from '/shared/upload-batch.js';
import {openArchiveUpload} from '/shared/archive-upload.js';

const availablePages=new Set(['home','guide','case','faq','reviews']);
const availableTabs=new Set(['home','documents','messages']);
function routeFromURL(){const query=new URLSearchParams(location.search);return {page:availablePages.has(query.get('page'))?query.get('page'):'home',tab:availableTabs.has(query.get('tab'))?query.get('tab'):'home',caseId:query.get('case')||'',applicationStep:query.get('application')==='form'?'form':'intro'};}
const initialRoute=routeFromURL();
const blankDraft=()=>({name:'',court_id:'unknown',consultation:'',consent:false,idempotency_key:null});
const state={...initialRoute,case:null,error:null,publicData:{},publicError:null,publicLoaded:false,demoMode:false,startProfile:'demo',freshTesting:false,loadingCase:Boolean(session.token),authEpoch:0,navigationEpoch:0,applicationDraft:blankDraft()};
let loadSerial=0,publicSerial=0,refreshPending=false,renderPending=false;
const path=(suffix='')=>`/cases/${encodeURIComponent(state.case.id)}${suffix}`;
// History holds navigation coordinates only. Customer input stays in this tab's
// memory and is cleared on logout; it never enters URLs or persisted history.
const views=new Map(),messageDrafts=new Map();
const newEntry=()=>crypto.randomUUID();
let entryId=history.state?.portal?.id||newEntry();
let pendingView={id:entryId,scroll:history.state?.portal?.scroll||{x:0,y:0}},restoring=false;
history.scrollRestoration='manual';
history.replaceState({...history.state,portal:{id:entryId,scroll:pendingView.scroll}},'',location.href);
function captureView(persist=true){
  const text=document.querySelector('#message-text');
  if(text&&state.case)messageDrafts.set(state.case.id,text.value);
  const value={scroll:{x:window.scrollX,y:window.scrollY},details:[...document.querySelectorAll('main details')].map(node=>node.open)};
  views.set(entryId,value);
  if(persist&&history.state?.portal?.id===entryId)history.replaceState({...history.state,portal:{id:entryId,scroll:value.scroll}},'',location.href);
  return value;
}
function restoreView(){
  const text=document.querySelector('#message-text');
  if(text&&state.case&&messageDrafts.has(state.case.id)&&text.value!==messageDrafts.get(state.case.id))text.value=messageDrafts.get(state.case.id);
  if(!pendingView||state.loadingCase||(!state.publicLoaded&&state.page!=='case'))return;
  const target=pendingView,value=views.get(target.id)||target;
  [...document.querySelectorAll('main details')].forEach((node,index)=>{if(value.details?.[index]!==undefined)node.open=value.details[index];});
  restoring=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(entryId===target.id&&pendingView===target&&!state.loadingCase){window.scrollTo({left:value.scroll?.x||0,top:value.scroll?.y||0,behavior:'instant'});pendingView=null;}
    restoring=false;
  }));
}
function updateURL(replace=true){
  const url=new URL(location.href);url.searchParams.set('page',state.page);
  for(const key of ['case','tab','application'])url.searchParams.delete(key);
  if(state.page==='case'){
    url.searchParams.set('tab',state.tab);
    if(state.caseId)url.searchParams.set('case',state.caseId);
    else if(state.applicationStep==='form')url.searchParams.set('application','form');
  }
  const snapshot={...history.state,portal:{id:entryId,scroll:pendingView?.scroll||{x:window.scrollX,y:window.scrollY}}};
  history[replace?'replaceState':'pushState'](snapshot,'',url);
}
function navigate(page,tab,options={}){
  const nextPage=availablePages.has(page)?page:'home',nextTab=availableTabs.has(tab)?tab:state.tab;
  const nextApplication=options.application==='form'?'form':options.application==='intro'?'intro':state.applicationStep;
  if(nextPage===state.page&&nextTab===state.tab&&nextApplication===state.applicationStep)return;
  const closing=new CustomEvent('portal:before-navigate',{detail:{}});window.dispatchEvent(closing);
  captureView();state.navigationEpoch+=1;state.page=nextPage;state.tab=nextTab;state.applicationStep=nextApplication;
  entryId=newEntry();pendingView={id:entryId,scroll:{x:0,y:0}};updateURL(Boolean(closing.detail.replaceCurrent));render();
  if(state.page==='case'&&session.user?.role==='client'&&!state.case&&!state.loadingCase)void load();
}
function clearUnavailableCase(){
  window.dispatchEvent(new CustomEvent('portal:before-navigate',{detail:{}}));
  loadSerial+=1;state.case=null;state.caseId='';state.error=null;state.loadingCase=false;
  messageDrafts.clear();state.applicationStep='intro';
  updateURL();render();
}
async function fetchSelectedCase(caseId){
  if(caseId)return api('/cases/'+encodeURIComponent(caseId));
  const response=await api('/cases'),cases=list(response.cases||response);
  return cases[0]?api('/cases/'+encodeURIComponent(cases[0].id)):null;
}
async function load({background=false}={}){
  if(session.user?.role!=='client')return;
  const epoch=state.authEpoch,serial=++loadSerial,caseId=state.caseId;
  let changed=!background;
  if(!background){if(!pendingView)captureView();state.loadingCase=true;render();}
  try{
    const next=await fetchSelectedCase(caseId);
    if(epoch!==state.authEpoch||serial!==loadSerial||caseId!==state.caseId)return;
    if(next&&caseId&&next.id!==caseId)throw new Error('요청한 사건의 응답을 확인할 수 없습니다.');
    if(next?.id===state.case?.id&&Number(next?.version)<Number(state.case?.version))return;
    changed=changed||JSON.stringify(next)!==JSON.stringify(state.case)||Boolean(state.error);
    state.case=next;state.caseId=next?.id||'';state.error=null;
    if(state.case)state.applicationStep='intro';
    if(state.page==='case')updateURL();
  }catch(error){
    if(epoch!==state.authEpoch||serial!==loadSerial)return;
    if([403,404].includes(error.status)){clearUnavailableCase();return;}
    state.error=error;changed=true;
  }finally{if(epoch===state.authEpoch&&serial===loadSerial){state.loadingCase=false;
    const editing=document.activeElement?.matches('input,textarea,select')||Boolean(document.querySelector('#message-text')?.value.trim());
    if(!background||((changed||renderPending)&&!editing)){render();}else if(changed){renderPending=true;}
  }}
}
async function loadPublic(){const serial=++publicSerial;try{const data=await api('/portal/public');if(serial!==publicSerial)return;state.publicData=data;state.publicError=null;}catch(error){if(serial===publicSerial)state.publicError=error;}finally{if(serial===publicSerial){state.publicLoaded=true;render();}}}
function clearPrivateMemory(){state.applicationDraft=blankDraft();messageDrafts.clear();views.clear();}
async function login(credentials){
  const result=await api('/auth/login',{method:'POST',body:{...credentials,username:String(credentials.username||'').trim()}});
  if(result.user?.role!=='client'){try{await api('/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+result.token}});}catch{}throw new Error('고객 계정으로 로그인해 주세요. 직원 업무공간은 별도로 이용해 주세요.');}
  state.authEpoch+=1;clearPrivateMemory();session.token=result.token;session.user=result.user;sessionStorage.setItem('debtoff-token',result.token);state.case=null;state.error=null;await load();
}
async function signOut(){window.dispatchEvent(new CustomEvent('portal:before-navigate',{detail:{}}));state.authEpoch+=1;loadSerial+=1;clearPrivateMemory();state.case=null;state.caseId='';state.error=null;state.loadingCase=false;state.applicationStep='intro';session.user=null;updateURL();render();await logout();session.user=null;render();}
function currentCaseGuard(){const epoch=state.authEpoch,caseId=state.case?.id;return ()=>epoch===state.authEpoch&&caseId===state.case?.id&&caseId===state.caseId;}
async function handoff(message){const current=currentCaseGuard();const result=await api('/portal/handoff',{method:'POST',body:{case_id:state.case.id,message,expected_version:state.case.version}});if(!current())return;state.case=result.case||result;render();}
async function readNotification(id){const current=currentCaseGuard(),navigation=state.navigationEpoch;const result=await api(path('/notifications/'+encodeURIComponent(id)+'/read'),{method:'POST',body:{expected_version:state.case.version}});if(!current())return false;state.case=result.case||result;render();return navigation===state.navigationEpoch;}
async function applyForConsultation(values){const epoch=state.authEpoch,navigation=state.navigationEpoch;const result=await api('/portal/applications',{method:'POST',body:values});if(epoch!==state.authEpoch)return;loadSerial+=1;state.case=result.case||result;state.caseId=state.case.id;state.applicationDraft=blankDraft();state.error=null;state.loadingCase=false;state.applicationStep='intro';if(navigation===state.navigationEpoch){captureView();entryId=newEntry();pendingView={id:entryId,scroll:{x:0,y:0}};state.page='case';state.tab='home';updateURL(false);}render();notify('상담 신청을 접수했습니다. 담당 직원 또는 변호사가 세부상담 방법을 안내합니다.');}
function render(){renderPending=false;renderPortal({state,user:session.user,request:api,onNavigate:navigate,onApplicationStep:step=>navigate('case','home',{application:step}),onApplicationDraft:draft=>{state.applicationDraft=draft;},onLogin:login,onLogout:signOut,onApply:applyForConsultation,onDownloadTesting:()=>download('/portal/testing-materials'+(state.case?.id?'?case_id='+encodeURIComponent(state.case.id):''),'연습자료.zip'),onRefreshPublic:loadPublic,onHandoff:handoff,onReadNotification:readNotification,errorHtml:state.error?errorPanel(state.error):''});restoreView();}
function upload(requestId){const current=currentCaseGuard();return openBatchUpload({caseData:state.case,requestId,role:'client',isCurrent:current,onComplete:async updated=>{if(!current())return;state.case=updated;render();await load({background:true});}});}
function uploadArchive(){const current=currentCaseGuard();return openArchiveUpload({caseData:state.case,isCurrent:current,onComplete:async updated=>{if(!current())return;state.case=updated;render();await load({background:true});}});}
document.addEventListener('input',event=>{if(event.target.id==='message-text'&&state.case)messageDrafts.set(state.case.id,event.target.value);});
document.addEventListener('click',async event=>{const tab=event.target.closest('[data-tab]'),action=event.target.closest('[data-action]');try{if(session.user?.role!=='client')return;if(tab){navigate('case',tab.dataset.tab);return;}if(!action||!['refresh','upload','upload-archive','download'].includes(action.dataset.action))return;action.disabled=true;if(action.dataset.action==='refresh')await load();if(action.dataset.action==='upload'&&state.case)upload(action.dataset.request);if(action.dataset.action==='upload-archive'&&state.case)uploadArchive();if(action.dataset.action==='download'&&state.case){const document=state.case.documents.find(item=>item.id===action.dataset.id);await download(path('/documents/'+encodeURIComponent(document.id)+'/download'),document.filename||document.name);}action.disabled=false;}catch(error){notify(error.message,'error');if(action)action.disabled=false;}});
document.addEventListener('submit',async event=>{if(event.target.id!=='message-form')return;event.preventDefault();if(session.user?.role!=='client'||!state.case)return;const current=currentCaseGuard(),caseId=state.case.id,button=event.target.querySelector('[type=submit]');button.disabled=true;try{const text=new FormData(event.target).get('text');const result=await api(path('/messages'),{method:'POST',body:{text,expected_version:state.case.version}});if(!current())return;state.case=result.case||result;messageDrafts.delete(caseId);event.target.reset();notify('메시지를 전달했습니다.');render();document.querySelector('#messages')?.scrollTo(0,100000);}catch(error){notify(error.message,'error');}finally{button.disabled=false;}});
window.addEventListener('session-expired',()=>{window.dispatchEvent(new CustomEvent('portal:before-navigate',{detail:{}}));state.authEpoch+=1;loadSerial+=1;clearPrivateMemory();session.user=null;state.case=null;state.caseId='';state.error=null;state.loadingCase=false;state.applicationStep='intro';updateURL();render();});
window.addEventListener('popstate',event=>{
  if(event.debtoffDialogHandled)return;
  captureView(false);const route=routeFromURL();state.navigationEpoch+=1;
  state.page=route.page;state.tab=route.tab;state.applicationStep=route.applicationStep;
  const requested=route.page==='case'?route.caseId:state.caseId,changed=requested!==state.caseId;
  if(changed){loadSerial+=1;state.case=null;state.caseId=requested;state.error=null;state.loadingCase=false;}
  entryId=history.state?.portal?.id||newEntry();pendingView={id:entryId,scroll:history.state?.portal?.scroll||{x:0,y:0}};
  if(!history.state?.portal)history.replaceState({...history.state,portal:{id:entryId,scroll:pendingView.scroll}},'',location.href);
  render();if(state.page==='case'&&session.user?.role==='client'&&(changed||!state.case))void load();
});
let scrollFrame=0;
window.addEventListener('scroll',()=>{if(restoring||pendingView||scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;captureView();});},{passive:true});
window.addEventListener('pagehide',()=>captureView());
setInterval(async()=>{if(refreshPending||!session.user||document.hidden||document.querySelector('dialog[open]')||state.loadingCase)return;refreshPending=true;try{await load({background:true});}finally{refreshPending=false;}},7000);
async function restoreSession(){if(!session.token)return;const epoch=state.authEpoch;try{const result=await api('/auth/me');if(epoch!==state.authEpoch)return;if((result.user||result).role!=='client'){await logout();session.user=null;state.loadingCase=false;return;}session.user=result.user||result;await load();}catch{if(epoch!==state.authEpoch)return;session.user=null;session.token=null;state.loadingCase=false;sessionStorage.removeItem('debtoff-token');}render();}
render();
void Promise.allSettled([loadPublic(),restoreSession(),Promise.all([api('/health').catch(()=>({})),api('/auth/config').catch(()=>({}))]).then(([health,config])=>{state.startProfile=config.start_profile||health.start_profile||'demo';state.demoMode=Boolean(config.allow_demo_shortcuts??health.demo_mode)||Boolean(state.startProfile==='fresh'&&config.local_test_accounts);state.freshTesting=Boolean((config.demo_mode??health.demo_mode)&&state.startProfile==='fresh');render();})]);
