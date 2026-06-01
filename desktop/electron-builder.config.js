module.exports = {
  appId: 'com.smallrock.desktop',
  productName: 'Small Rock',
  forceCodeSigning: false,
  directories: {
    output: 'release',
  },
  files: [
    'dist-electron/**/*',
    'src/assets/**/*',
  ],
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: 'src/assets/icons/icon.png',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Small Rock',
  },
};
