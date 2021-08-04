const { app, BrowserWindow, Menu, protocol } = require("electron")
const isDev = require('electron-is-dev')
const path = require("path")
require("@electron/remote/main").initialize()

app.win = null 
let isShown = true

app.whenReady().then(() => {
  app.win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 380,
    minHeight: 360,
    backgroundColor: '#fff',
    resizable: true,
    frame: process.platform === "darwin",
    autoHideMenuBar: process.platform === "darwin",
    show: false,
    webPreferences: { 
      zoomFactor: 1.0, 
      nodeIntegration: true, 
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: false,
      webSecurity: false,
      nodeIntegrationInWorker: true
    }
  })

  app.win.once('ready-to-show', () => { 
    app.win.show() 
  })

  app.win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );
  // Open the DevTools.
  if (isDev) {
    app.win.webContents.openDevTools({ mode: 'detach' });
  }

  app.win.on('closed', () => {
    app.quit()
  })

  app.win.on('hide', () => {
    isShown = false
  })

  app.win.on('show', function () {
    isShown = true
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  protocol.registerFileProtocol('file', (req, cb) => {
    const pathname = req.url.replace('file:///', '');
    callback(pathname)
  })
})

app.inspect = function () {
  app.win.toggleDevTools()
}

app.toggleFullscreen = function () {
  app.win.setFullScreen(!app.win.isFullScreen())
}

app.toggleMenubar = function () {
  app.win.setMenuBarVisibility(!app.win.isMenuBarVisible())
}

app.toggleVisible = function () {
  if (process.platform !== 'darwin') {
    if (!app.win.isMinimized()) { app.win.minimize() } else { app.win.restore() }
  } else {
    if (isShown && !app.win.isFullScreen()) { app.win.hide() } else { app.win.show() }
  }
}

app.injectMenu = function (menu) {
  try {
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu))
  } catch (err) {
    console.warn('Cannot inject menu.')
  }
}
