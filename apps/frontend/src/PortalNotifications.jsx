import React,{useState} from 'react';
import {date} from '../../shared/ui.js';

export function noticeUnread(item){return !item.resolved_at&&(typeof item.unread==='boolean'?item.unread:typeof item.read_by_current_user==='boolean'?!item.read_by_current_user:!item.read_at);}
function destination(item){
  if(['consultation_request','consultation_requested'].includes(item.kind))return {label:'세부상담 안내',action:'상담 안내 확인',tab:'messages'};
  if(['message','client_message','staff_message','lawyer_message','new_message','message_received'].includes(item.kind))return {label:'담당자 메시지',action:'메시지 확인',tab:'messages'};
  if(['file','document','document_uploaded','document_received','document_shared','file_shared'].includes(item.kind))return {label:'파일 안내',action:'파일 확인',tab:'documents'};
  if(['document_request','document_rerequest','request_updated','document_rejected','document_verified'].includes(item.kind))return {label:'서류 요청·확인',action:'자료 확인',tab:'documents'};
  return {label:'사건 안내',action:'내 사건 확인',tab:'home'};
}
export default function PortalNotifications({notices,onRead,onNavigate}){
  const [busy,setBusy]=useState(''),[error,setError]=useState('');
  const unread=notices.filter(noticeUnread).length;
  async function read(item,open=false){
    if(busy)return;setBusy(item.id);setError('');
    try{if(noticeUnread(item))await onRead(item.id);if(open)onNavigate('case',destination(item).tab);}
    catch(problem){setError(problem.message);}
    finally{setBusy('');}
  }
  return <section className="public-notifications" aria-label="내 사건 알림"><header><h2>내 사건 알림</h2><span role="status">미확인 {unread}건</span></header>{error&&<p className="public-form-error" role="alert">{error}</p>}{notices.length?notices.slice().reverse().map(item=>{const target=destination(item),isUnread=noticeUnread(item);return <article key={item.id} className={isUnread?'notice-unread':'notice-read'} data-notice-id={item.id}><div className="notice-category"><span>{target.label}</span><span>{item.resolved_at?'처리 완료':isUnread?'미확인':'확인함'}</span></div><strong>{item.title||target.label}</strong><p>{item.message||item.body||item.reason||'내 사건에서 안내 내용을 확인해 주세요.'}</p><time>{date(item.created_at,true)}</time><div className="notice-actions"><button disabled={Boolean(busy)} onClick={()=>read(item,true)}>{target.action}</button>{isUnread&&<button disabled={Boolean(busy)} onClick={()=>read(item)}>{busy===item.id?'확인 중':'확인함'}</button>}</div></article>;}):<p>아직 받은 알림이 없습니다. 담당자 메시지와 서류 안내가 도착하면 이곳에 표시합니다.</p>}</section>;
}
