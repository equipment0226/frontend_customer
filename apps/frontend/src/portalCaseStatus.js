const stages={
  awaiting_consultation:{label:'담당자 상담 안내 대기',title:'상담 신청을 접수했습니다.',description:'담당 직원 또는 변호사가 내용을 확인하고 세부상담 방법을 안내합니다.',step:0},
  consultation_requested:{label:'세부상담 안내 도착',title:'담당자의 세부상담 안내를 확인해 주세요.',description:'담당자 문의에서 상담 방법과 확인할 내용을 살펴보고 답변해 주세요.',step:1},
};

export function consultationState(c){
  if(!c)return null;
  const status=c.intake?.status;
  if(status==='completed')return null;
  if(status==='received')return stages.awaiting_consultation;
  if(status==='consultation_requested')return stages.consultation_requested;
  if(['상담 접수','상담 신청','상담 대기','세부상담 대기','세부 상담 대기'].includes(c.stage))return stages.awaiting_consultation;
  return null;
}

export function customerMatterLabel(c){
  const number=typeof c?.matter_number==='string'?c.matter_number.trim():'';
  // Internal storage identifiers are used only in requests, never as customer references.
  return number&&number!==c.id&&!/^case-[a-f0-9]+$/i.test(number)?'수임번호 '+number:null;
}
