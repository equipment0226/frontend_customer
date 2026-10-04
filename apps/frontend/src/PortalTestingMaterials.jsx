import React,{useState} from 'react';

export default function PortalTestingMaterials({onExample,onDownload}){
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function run(kind){setBusy(kind);setError('');setNotice('');try{if(kind==='example'){await onExample();setNotice('가상 고객의 상담 예시를 채웠습니다. 내용을 확인하고 동의한 뒤 직접 신청해 주세요.');}else await onDownload();}catch(problem){setError(problem.message);}finally{setBusy('');}}
  return <aside className="portal-testing-materials" aria-label="연습용 가상자료"><div><strong>처음부터 직접 연습해 보세요.</strong><p>새 가상 고객의 상담 예시와 제출용 파일입니다. 실제 고객의 개인정보는 포함하지 않습니다.</p></div><div className="public-actions">{onExample&&<button type="button" className="public-button secondary" disabled={Boolean(busy)} onClick={()=>run('example')}>{busy==='example'?'예시를 불러오고 있습니다':'가상 상담 예시 불러오기'}</button>}<button type="button" className="public-button secondary" disabled={Boolean(busy)} onClick={()=>run('download')}>{busy==='download'?'자료를 준비하고 있습니다':'연습자료 ZIP'}</button></div>{notice&&<p role="status">{notice}</p>}{error&&<p className="public-form-error" role="alert">{error}</p>}</aside>;
}
