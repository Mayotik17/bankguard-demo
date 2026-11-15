import {defineConfig} from '@playwright/test';
const external=process.env.BROWSER_TEST_URL;
export default defineConfig({
 testDir:'./e2e',fullyParallel:true,forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:external||'http://127.0.0.1:3300',trace:'retain-on-failure',screenshot:'only-on-failure',
  launchOptions:process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'laptop',use:{viewport:{width:1280,height:800}}}],
 webServer:external?undefined:{command:'node server.js --port 3300',url:'http://127.0.0.1:3300',reuseExistingServer:!process.env.CI}
});
