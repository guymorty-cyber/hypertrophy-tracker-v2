/* ---------- export/import ---------- */
let importSequence=0;
function downloadJSON(content,name){
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportData(){
  if(storageBlocked){exportRecovery();return;}
  downloadJSON(JSON.stringify(DATA,null,2),'hypertrophy-tracker-'+todayISO()+'.json');
}
function importData(e){
  const sequence=++importSequence,file=e.target.files[0];
  if(!file)return;
  const expected=JSON.stringify(DATA),reader=new FileReader();
  reader.onload=ev=>{
    if(sequence!==importSequence)return;
    try{
      if(JSON.stringify(DATA)!==expected)throw new Error('Your data changed while this file was loading. Select the file again to review the replacement.');
      const parsed=validateData(JSON.parse(ev.target.result));
      if(!confirm('Import will replace your current data. Continue?')) return;
      parsed.restEndAt=null;
      parsed.sessions=rebuildHistory(parsed.sessions);
      if(!commitData(parsed,true)) return;
      deletedWorkouts=[];
      document.getElementById('undoPanel').hidden=true;
      stopRestTimer(false); closeModal(); renderTab();
      alert('Data imported and saved.');
    }catch(err){ alert('Could not import: '+err.message); }
    finally{ e.target.value=''; }
  };
  reader.onerror=()=>{if(sequence!==importSequence)return;e.target.value='';alert('Could not read that file. Your current data has not changed.');};
  reader.readAsText(file);
}
