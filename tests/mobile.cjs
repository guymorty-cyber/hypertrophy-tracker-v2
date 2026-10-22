'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('Keyboard geometry follows the visible viewport and clamps impossible or non-editing sizes',()=>{
 const {app}=boot(script),v={height:500,offsetTop:20,scale:1};assert.equal(app.keyboardInset(844,v,true),324);assert.equal(app.keyboardInset(844,v,false),0);assert.equal(app.keyboardInset(844,{height:900,offsetTop:0},true),0);assert.equal(app.keyboardInset(844,null,true),0);
});
test('Browser chrome and pinch zoom do not masquerade as a keyboard',()=>{
 const {app}=boot(script);assert.equal(app.keyboardInset(844,{height:760,offsetTop:0,scale:1},true),0);assert.equal(app.keyboardInset(844,{height:500,offsetTop:0,scale:1.5},true),0);assert.equal(app.keyboardInset(844,{height:NaN,offsetTop:0},true),0);
});
test('Entry navigation excludes completion checkboxes, files, dates, disabled and readonly fields',()=>{
 const {app}=boot(script);for(const type of ['number','text','search','tel'])assert(app.isEntryField({tagName:'INPUT',type}));assert(app.isEntryField({tagName:'TEXTAREA'}));for(const type of ['checkbox','radio','file','date','hidden'])assert(!app.isEntryField({tagName:'INPUT',type}));assert(!app.isEntryField({tagName:'INPUT',type:'number',disabled:true}));assert(!app.isEntryField({tagName:'INPUT',type:'number',readOnly:true}));assert(!app.isEntryField(null));
});
test('Set entry describes load versus reps without relabelling or changing the log',()=>{
 const {app}=boot(script);const field={closest:()=>true,dataset:{setidx:'2',field:'weight'}},before=JSON.stringify(field.dataset);assert.equal(app.entryDescription(field),'Set 3 · kg');field.dataset.field='reps';assert.equal(app.entryDescription(field),'Set 3 · reps');field.dataset.field='weight';assert.equal(JSON.stringify(field.dataset),before);
});
test('Update states distinguish offline/failure from an available release and never imply a save',()=>{
 const {app}=boot(script);assert(app.appUpdateMessage('offline').includes('reconnect'));assert(app.appUpdateMessage('unavailable').includes('unchanged'));assert(app.appUpdateMessage('ready').includes('saves first'));assert(app.appUpdateMessage('downloading').includes('downloading'));assert(app.appUpdateMessage('current').includes('latest published'));
});
test('App status is read-only and older data keeps its original storage and settings',()=>{
 const h=boot(script);h.app.startSession(0);const raw=h.records.get('htData_v1'),before=JSON.stringify(h.app.data);const html=h.app.renderAppExperience();assert(html.includes('App &amp; offline'));assert(html.includes('Check for updates'));assert.equal(h.app.installedApp(),false);assert.equal(h.records.get('htData_v1'),raw);assert.equal(JSON.stringify(h.app.data),before);
});
console.log(count+' Phase 8 phone/PWA logic checks passed');
