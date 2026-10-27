const {chromium}=require(process.env.BEE_PLAYWRIGHT_MODULE || "../.ui-test/node_modules/playwright");
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
(async()=>{
 const child=spawn(process.env.PYTHON || 'python',['tools/test_cloud_ui_fixture.py'],{cwd:process.cwd(),env:process.env,windowsHide:true});
 let browser;
 try {
  const port=await new Promise((resolve,reject)=>{child.stdout.once('data',v=>resolve(Number(v.toString().trim())));child.once('error',reject);child.once('exit',code=>reject(new Error('Fixture exited before initialization: '+code)));child.stderr.on('data',v=>process.stderr.write(v));});
  browser=await chromium.launch({...(process.env.BEE_BROWSER_EXE?{executablePath:process.env.BEE_BROWSER_EXE}:{}),headless:true});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Sign in to cloud',exact:true}).click();
  await page.getByText('Cloud mode · automatic saving on',{exact:true}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'Use local-only mode',exact:true}).click();
  await page.getByRole('button',{name:'Use cloud mode (automatic sync)',exact:true}).waitFor();
  await page.getByRole('button',{name:'Use cloud mode (automatic sync)',exact:true}).click();
  await page.getByRole('button',{name:'Back to practice',exact:true}).click();
  await page.getByRole('button',{name:'Classrooms',exact:true}).click();
  await page.getByLabel('Classroom name',{exact:true}).fill('UI spelling classroom');
  await page.getByRole('button',{name:'Create classroom',exact:true}).click();
  await page.getByRole('heading',{name:'UI spelling classroom',exact:true}).waitFor();
  await page.getByRole('button',{name:'View students',exact:true}).click();
  await page.getByText('No students have joined.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Local browser login approval, default cloud mode, mode switching and classroom creation passed without JavaScript errors.');
 }finally{await browser?.close();child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
