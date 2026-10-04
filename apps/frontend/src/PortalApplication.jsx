import React,{useRef,useState} from 'react';
import PortalTestingMaterials from './PortalTestingMaterials.jsx';

export default function PortalApplication({courts=[],onApply,onReload,testing=false,request,onDownloadTesting}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  // Keep the same key after a lost response so retrying cannot create a second case.
  const requestKey=useRef(null);
  const formRef=useRef(null);
  async function fillExample(){const example=await request('/portal/testing-application');const form=formRef.current;if(!form)return;form.elements.name.value=example.name||'';form.elements.consultation.value=example.consultation||'';form.elements.court_id.value=courts.some(court=>court.id===example.court_id)?example.court_id:'unknown';form.elements.consent.checked=false;}
  async function submit(event){
    event.preventDefault();if(busy)return;
    const values=Object.fromEntries(new FormData(event.currentTarget));
    if(!values.name?.trim()||!values.consultation?.trim()){setError('성함과 상담 내용을 입력해 주세요.');return;}
    if(!requestKey.current)requestKey.current=crypto.randomUUID();
    setBusy(true);setError('');
    try{await onApply({name:values.name.trim(),court_id:values.court_id,consultation:values.consultation.trim(),consent:values.consent==='on',idempotency_key:requestKey.current});}
    catch(problem){setError(problem.message);}
    finally{setBusy(false);}
  }
  return <section className="portal-application" aria-label="상담·신청 시작">
    <div className="application-intro"><div><span className="eyebrow">YOUR FIRST STEP, WITH US</span><h1>첫 상담부터,<br/>함께 시작하겠습니다.</h1><p>아직 접수된 사건이 없습니다.<br/>현재 상황과 궁금한 점을 남겨 주세요. 접수 후 담당 직원 또는 변호사가 세부상담 방법을 안내합니다.</p>{!open&&<button className="public-button" onClick={()=>setOpen(true)}>상담·신청 시작 <span aria-hidden="true">↗</span></button>}<small>사무소 상담 신청이며, 법원에 서류를 제출하는 단계는 아닙니다.</small></div><img src="/shared/images/hopeful-path.jpg" alt="햇살이 비치는 숲길"/></div>
    {open&&<form ref={formRef} className="application-form" onSubmit={submit} aria-label="상담 신청서"><div className="application-form-heading"><span className="eyebrow">TELL US YOUR STORY</span><h2>지금의 상황을 알려 주세요.</h2><p>정확히 정리되지 않아도 괜찮습니다. 남겨 주신 내용을 담당자가 먼저 확인하고 세부상담을 진행합니다.</p></div>{testing&&<PortalTestingMaterials onExample={fillExample} onDownload={onDownloadTesting}/>}<div className="field-grid"><label className="field"><span>성함</span><input name="name" autoComplete="name" required minLength={2} maxLength={80} disabled={busy} placeholder="상담받으실 분의 성함"/></label><label className="field"><span>신청 예정 법원</span><select name="court_id" required disabled={busy} defaultValue="unknown"><option value="unknown">상담 시 확인</option>{courts.map(court=><option key={court.id} value={court.id}>{court.name}</option>)}</select><small>관할은 접수 후 담당자와 다시 확인합니다.</small></label></div>{!courts.length&&<p className="public-form-error" role="alert">법원 목록을 불러오지 못했습니다. 관할을 모르면 ‘상담 시 확인’으로 접수할 수 있습니다. <button type="button" onClick={onReload}>다시 불러오기</button></p>}<label className="field"><span>상담 내용</span><textarea name="consultation" required minLength={10} maxLength={10000} rows={7} disabled={busy} placeholder="채무가 생긴 경위, 현재 소득과 재산, 궁금한 점을 편하게 적어 주세요. 주민등록번호나 비밀번호는 적지 마세요."/></label><label className="application-consent"><input type="checkbox" name="consent" required disabled={busy}/><span>상담 접수와 사건 준비를 위해 입력한 내용을 담당 직원·변호사가 확인하는 데 동의합니다.</span></label>{error&&<p className="public-form-error" role="alert">{error}</p>}<div className="public-actions"><button type="submit" className="public-button" disabled={busy}>{busy?'상담을 접수하고 있습니다':'상담 신청 보내기'}</button><button type="button" className="public-button secondary" disabled={busy} onClick={()=>setOpen(false)}>다음에 작성</button></div></form>}
  </section>;
}
