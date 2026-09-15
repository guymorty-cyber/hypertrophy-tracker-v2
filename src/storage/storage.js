const KEY='ht_app_v2';
const LEGACY_KEYS=['ht_sessions','hypertrophy_tracker','hypertrophyTracker'];

export function loadStore(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw){const data=JSON.parse(raw);return {...data,version:2};}
  }catch{}
  const sessions=loadLegacySessions();
  return {version:2,sessions,programme:null,bodyweight:[],settings:{}};
}

function loadLegacySessions(){
  for(const key of LEGACY_KEYS){
    try{const raw=localStorage.getItem(key);if(!raw)continue;const value=JSON.parse(raw);if(Array.isArray(value))return value;if(Array.isArray(value.sessions))return value.sessions;}catch{}
  }
  return [];
}

export function saveStore(store){localStorage.setItem(KEY,JSON.stringify({...store,version:2}));}
