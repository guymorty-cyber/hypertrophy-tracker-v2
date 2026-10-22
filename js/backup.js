/* ---------- export/import ---------- */
function downloadJSON(content,name){
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportData(){
  downloadJSON(JSON.stringify(DATA,null,2),'hypertrophy-tracker-'+todayISO()+'.json');
}
function importData(e){
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const parsed=validateData(JSON.parse(ev.target.result));
      if(!confirm('Import will replace your current data. Continue?')) return;
      parsed.restEndAt=null;
      if(!commitData(parsed,true)) return;
      deletedWorkout=null;
      document.getElementById('undoPanel').hidden=true;
      stopRestTimer(false); closeModal(); renderTab();
      alert('Data imported and saved.');
    }catch(err){ alert('Could not import: '+err.message); }
    finally{ e.target.value=''; }
  };
  reader.onerror=()=>alert('Could not read that file. Your current data has not changed.');
  reader.readAsText(file);
}
