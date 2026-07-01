
export type ThemeBase = 'dark' | 'light'

export interface ThemeSpec {
  id: string
  name: string
  base: ThemeBase
  bg: string
  chrome: string
  surface: string
  raised: string
  overlay: string
  border: string
  borderStrong: string
  text: string
  textSec: string
  textMuted: string
  accent: string
  accentHover: string
  success?: string
  danger?: string
  warning?: string
}

export interface ThemeDef {
  id: string
  name: string
  base: ThemeBase
  vars: Record<string, string>
}

export const THEME_VAR_KEYS = [
  '--color-bg',
  '--color-chrome',
  '--color-surface',
  '--color-surface-raised',
  '--color-surface-overlay',
  '--color-border',
  '--color-border-strong',
  '--color-text',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-soft',
  '--color-success',
  '--color-danger',
  '--color-warning'
] as const

function expand(s: ThemeSpec): ThemeDef {
  const dark = s.base === 'dark'
  const accent = dark ? '#e5e5e5' : '#1a1a1a'
  const accentHover = dark ? '#ffffff' : '#000000'
  return {
    id: s.id,
    name: s.name,
    base: s.base,
    vars: {
      '--color-bg': s.bg,
      '--color-chrome': s.chrome,
      '--color-surface': s.surface,
      '--color-surface-raised': s.raised,
      '--color-surface-overlay': s.overlay,
      '--color-border': s.border,
      '--color-border-strong': s.borderStrong,
      '--color-text': s.text,
      '--color-text-secondary': s.textSec,
      '--color-text-muted': s.textMuted,
      '--color-accent': accent,
      '--color-accent-hover': accentHover,
      '--color-accent-soft': dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      '--color-success': s.success ?? (dark ? '#3fb950' : '#1a7f37'),
      '--color-danger': s.danger ?? (dark ? '#f0524a' : '#d1242f'),
      '--color-warning': s.warning ?? (dark ? '#d8a13a' : '#9a6700')
    }
  }
}

const SPECS: ThemeSpec[] = [
  {
    id: 'crab-dark', name: 'CrabCode Dark', base: 'dark',
    bg: '#0e100f', chrome: '#0b0d0c', surface: '#161817', raised: '#1c1f1d', overlay: '#232624',
    border: '#2a2c2a', borderStrong: '#42433d',
    text: '#fffce1', textSec: '#a8a896', textMuted: '#7c7c6f',
    accent: '#e5e5e5', accentHover: '#ffffff', success: '#0ae448', danger: '#ff6b6b', warning: '#ff8709'
  },
  {
    id: 'github-dark', name: 'GitHub Dark', base: 'dark',
    bg: '#0d1117', chrome: '#010409', surface: '#0d1117', raised: '#161b22', overlay: '#21262d',
    border: '#30363d', borderStrong: '#484f58',
    text: '#e6edf3', textSec: '#7d8590', textMuted: '#6e7681',
    accent: '#2f81f7', accentHover: '#58a6ff', success: '#3fb950', danger: '#f85149', warning: '#d29922'
  },
  {
    id: 'github-dark-dimmed', name: 'GitHub Dark Dimmed', base: 'dark',
    bg: '#22272e', chrome: '#1c2128', surface: '#22272e', raised: '#2d333b', overlay: '#373e47',
    border: '#444c56', borderStrong: '#545d68',
    text: '#adbac7', textSec: '#768390', textMuted: '#636e7b',
    accent: '#539bf5', accentHover: '#6cb6ff', success: '#57ab5a', danger: '#e5534b', warning: '#c69026'
  },
  {
    id: 'jetbrains-darcula', name: 'JetBrains Darcula', base: 'dark',
    bg: '#2b2b2b', chrome: '#3c3f41', surface: '#313335', raised: '#3c3f41', overlay: '#4b4f52',
    border: '#4e5254', borderStrong: '#5e6366',
    text: '#a9b7c6', textSec: '#808080', textMuted: '#6a6a6a',
    accent: '#4e8ad4', accentHover: '#6aa3e0', danger: '#cc6666', warning: '#ffc66d'
  },
  {
    id: 'jetbrains-dark', name: 'JetBrains New Dark', base: 'dark',
    bg: '#1e1f22', chrome: '#2b2d30', surface: '#1e1f22', raised: '#2b2d30', overlay: '#393b40',
    border: '#393b40', borderStrong: '#4e5157',
    text: '#dfe1e5', textSec: '#9da0a8', textMuted: '#6f737a',
    accent: '#3574f0', accentHover: '#5a8bf5'
  },
  {
    id: 'cursor-dark', name: 'Cursor Dark', base: 'dark',
    bg: '#1a1a1a', chrome: '#1e1e1e', surface: '#1c1c1c', raised: '#262626', overlay: '#2f2f2f',
    border: '#2e2e2e', borderStrong: '#3d3d3d',
    text: '#e4e4e4', textSec: '#9b9b9b', textMuted: '#6a6a6a',
    accent: '#5b9dff', accentHover: '#7db0ff'
  },
  {
    id: 'claude-dark', name: 'Claude', base: 'dark',
    bg: '#1f1e1c', chrome: '#262521', surface: '#222120', raised: '#2c2a27', overlay: '#383530',
    border: '#393631', borderStrong: '#4a463f',
    text: '#f0eee6', textSec: '#a8a299', textMuted: '#736e64',
    accent: '#d97757', accentHover: '#e08e72', warning: '#d9a45a'
  },
  {
    id: 'codex-dark', name: 'Codex', base: 'dark',
    bg: '#0e1117', chrome: '#0a0d12', surface: '#10141b', raised: '#181d26', overlay: '#222834',
    border: '#262d38', borderStrong: '#36404e',
    text: '#e8eaed', textSec: '#9aa4b2', textMuted: '#6b7280',
    accent: '#10a37f', accentHover: '#1cc09a', success: '#10a37f'
  },
  {
    id: 'vscode-dark', name: 'VS Code Dark+', base: 'dark',
    bg: '#1e1e1e', chrome: '#252526', surface: '#1e1e1e', raised: '#2d2d30', overlay: '#37373d',
    border: '#3c3c3c', borderStrong: '#505050',
    text: '#d4d4d4', textSec: '#9d9d9d', textMuted: '#6e6e6e',
    accent: '#0e639c', accentHover: '#1177bb', warning: '#cca700'
  },
  {
    id: 'one-dark', name: 'One Dark Pro', base: 'dark',
    bg: '#282c34', chrome: '#21252b', surface: '#282c34', raised: '#2c313a', overlay: '#3a3f4b',
    border: '#3e4451', borderStrong: '#4b515f',
    text: '#abb2bf', textSec: '#828997', textMuted: '#5c6370',
    accent: '#61afef', accentHover: '#7cc0f5', success: '#98c379', danger: '#e06c75', warning: '#e5c07b'
  },
  {
    id: 'dracula', name: 'Dracula', base: 'dark',
    bg: '#282a36', chrome: '#21222c', surface: '#282a36', raised: '#343746', overlay: '#424458',
    border: '#44475a', borderStrong: '#565970',
    text: '#f8f8f2', textSec: '#b8bcca', textMuted: '#6272a4',
    accent: '#bd93f9', accentHover: '#caa5fb', success: '#50fa7b', danger: '#ff5555', warning: '#f1fa8c'
  },
  {
    id: 'monokai', name: 'Monokai', base: 'dark',
    bg: '#272822', chrome: '#1f201b', surface: '#272822', raised: '#31322a', overlay: '#3e3f36',
    border: '#3e3d32', borderStrong: '#4f4e40',
    text: '#f8f8f2', textSec: '#b0b0a6', textMuted: '#75715e',
    accent: '#a6e22e', accentHover: '#beea5e', danger: '#f92672', warning: '#e6db74'
  },
  {
    id: 'monokai-pro', name: 'Monokai Pro', base: 'dark',
    bg: '#2d2a2e', chrome: '#221f22', surface: '#2d2a2e', raised: '#363338', overlay: '#444145',
    border: '#403e41', borderStrong: '#524f52',
    text: '#fcfcfa', textSec: '#c1c0c0', textMuted: '#939293',
    accent: '#ffd866', accentHover: '#ffe28a', danger: '#ff6188', warning: '#fc9867'
  },
  {
    id: 'solarized-dark', name: 'Solarized Dark', base: 'dark',
    bg: '#002b36', chrome: '#00252e', surface: '#073642', raised: '#0a4250', overlay: '#0f4d5c',
    border: '#0f4d5c', borderStrong: '#22606e',
    text: '#93a1a1', textSec: '#839496', textMuted: '#586e75',
    accent: '#268bd2', accentHover: '#3fa0e3', success: '#859900', danger: '#dc322f', warning: '#b58900'
  },
  {
    id: 'nord', name: 'Nord', base: 'dark',
    bg: '#2e3440', chrome: '#272b35', surface: '#2e3440', raised: '#3b4252', overlay: '#434c5e',
    border: '#434c5e', borderStrong: '#4c566a',
    text: '#eceff4', textSec: '#d8dee9', textMuted: '#7b8294',
    accent: '#88c0d0', accentHover: '#9fd0de', success: '#a3be8c', danger: '#bf616a', warning: '#ebcb8b'
  },
  {
    id: 'gruvbox-dark', name: 'Gruvbox Dark', base: 'dark',
    bg: '#282828', chrome: '#1d2021', surface: '#282828', raised: '#32302f', overlay: '#3c3836',
    border: '#3c3836', borderStrong: '#504945',
    text: '#ebdbb2', textSec: '#bdae93', textMuted: '#928374',
    accent: '#fabd2f', accentHover: '#fbcb53', success: '#b8bb26', danger: '#fb4934', warning: '#fe8019'
  },
  {
    id: 'tokyo-night', name: 'Tokyo Night', base: 'dark',
    bg: '#1a1b26', chrome: '#16161e', surface: '#1a1b26', raised: '#24283b', overlay: '#2f3549',
    border: '#2f3549', borderStrong: '#3b4261',
    text: '#c0caf5', textSec: '#9aa5ce', textMuted: '#565f89',
    accent: '#7aa2f7', accentHover: '#95b4f9', success: '#9ece6a', danger: '#f7768e', warning: '#e0af68'
  },
  {
    id: 'tokyo-night-storm', name: 'Tokyo Night Storm', base: 'dark',
    bg: '#24283b', chrome: '#1f2335', surface: '#24283b', raised: '#2c324a', overlay: '#363c54',
    border: '#363c54', borderStrong: '#444b6a',
    text: '#c0caf5', textSec: '#9aa5ce', textMuted: '#565f89',
    accent: '#7aa2f7', accentHover: '#95b4f9', success: '#9ece6a', danger: '#f7768e', warning: '#e0af68'
  },
  {
    id: 'night-owl', name: 'Night Owl', base: 'dark',
    bg: '#011627', chrome: '#01111d', surface: '#011627', raised: '#0b2942', overlay: '#13344f',
    border: '#13344f', borderStrong: '#1d4763',
    text: '#d6deeb', textSec: '#a2b3c4', textMuted: '#637777',
    accent: '#82aaff', accentHover: '#9cbcff', success: '#addb67', danger: '#ef5350', warning: '#ecc48d'
  },
  {
    id: 'palenight', name: 'Palenight', base: 'dark',
    bg: '#292d3e', chrome: '#242837', surface: '#292d3e', raised: '#323750', overlay: '#3c4260',
    border: '#3c4260', borderStrong: '#4b5273',
    text: '#a6accd', textSec: '#8d92b3', textMuted: '#676e95',
    accent: '#c792ea', accentHover: '#d3a8ef', success: '#c3e88d', danger: '#f07178', warning: '#ffcb6b'
  },
  {
    id: 'material-dark', name: 'Material Dark', base: 'dark',
    bg: '#212121', chrome: '#1a1a1a', surface: '#212121', raised: '#2a2a2a', overlay: '#353535',
    border: '#333333', borderStrong: '#474747',
    text: '#eeffff', textSec: '#b2ccd6', textMuted: '#757575',
    accent: '#80cbc4', accentHover: '#9bd6d0', success: '#c3e88d', danger: '#f07178', warning: '#ffcb6b'
  },
  {
    id: 'cobalt2', name: 'Cobalt2', base: 'dark',
    bg: '#193549', chrome: '#122738', surface: '#193549', raised: '#1f4662', overlay: '#28557a',
    border: '#28557a', borderStrong: '#35689a',
    text: '#ffffff', textSec: '#aabfd0', textMuted: '#6c8aa3',
    accent: '#ffc600', accentHover: '#ffd133', danger: '#ff628c', warning: '#ff9d00'
  },
  {
    id: 'synthwave-84', name: "SynthWave '84", base: 'dark',
    bg: '#262335', chrome: '#1f1c2e', surface: '#262335', raised: '#2f2b43', overlay: '#3b3556',
    border: '#3b3556', borderStrong: '#4d4670',
    text: '#f8f8f2', textSec: '#c4bedb', textMuted: '#8b85a8',
    accent: '#ff7edb', accentHover: '#ff9be4', success: '#72f1b8', danger: '#fe4450', warning: '#fede5d'
  },
  {
    id: 'ayu-dark', name: 'Ayu Dark', base: 'dark',
    bg: '#0a0e14', chrome: '#070a0f', surface: '#0d1016', raised: '#131721', overlay: '#1c212c',
    border: '#1c212c', borderStrong: '#2a3038',
    text: '#bfbdb6', textSec: '#8b8985', textMuted: '#5c6166',
    accent: '#ffb454', accentHover: '#ffc473', success: '#aad94c', danger: '#f07178', warning: '#ffb454'
  },
  {
    id: 'ayu-mirage', name: 'Ayu Mirage', base: 'dark',
    bg: '#1f2430', chrome: '#191e2a', surface: '#1f2430', raised: '#272d3a', overlay: '#333a48',
    border: '#333a48', borderStrong: '#424a5a',
    text: '#cccac2', textSec: '#9a978d', textMuted: '#707a8c',
    accent: '#ffcc66', accentHover: '#ffd685', success: '#87d96c', danger: '#f28779', warning: '#ffcc66'
  },
  {
    id: 'catppuccin-mocha', name: 'Catppuccin Mocha', base: 'dark',
    bg: '#1e1e2e', chrome: '#181825', surface: '#1e1e2e', raised: '#28283d', overlay: '#313244',
    border: '#313244', borderStrong: '#45475a',
    text: '#cdd6f4', textSec: '#a6adc8', textMuted: '#7f849c',
    accent: '#89b4fa', accentHover: '#a0c4fb', success: '#a6e3a1', danger: '#f38ba8', warning: '#f9e2af'
  },
  {
    id: 'catppuccin-macchiato', name: 'Catppuccin Macchiato', base: 'dark',
    bg: '#24273a', chrome: '#1e2030', surface: '#24273a', raised: '#2d3047', overlay: '#363a4f',
    border: '#363a4f', borderStrong: '#494d64',
    text: '#cad3f5', textSec: '#a5adcb', textMuted: '#8087a2',
    accent: '#8aadf4', accentHover: '#a1bdf6', success: '#a6da95', danger: '#ed8796', warning: '#eed49f'
  },
  {
    id: 'catppuccin-frappe', name: 'Catppuccin Frappé', base: 'dark',
    bg: '#303446', chrome: '#292c3c', surface: '#303446', raised: '#3a3f52', overlay: '#414559',
    border: '#414559', borderStrong: '#51576d',
    text: '#c6d0f5', textSec: '#a5adce', textMuted: '#838ba7',
    accent: '#8caaee', accentHover: '#a3bbf1', success: '#a6d189', danger: '#e78284', warning: '#e5c890'
  },
  {
    id: 'rose-pine', name: 'Rosé Pine', base: 'dark',
    bg: '#191724', chrome: '#15131f', surface: '#1f1d2e', raised: '#26233a', overlay: '#2f2b45',
    border: '#2f2b45', borderStrong: '#403d57',
    text: '#e0def4', textSec: '#908caa', textMuted: '#6e6a86',
    accent: '#c4a7e7', accentHover: '#d0b8ec', success: '#9ccfd8', danger: '#eb6f92', warning: '#f6c177'
  },
  {
    id: 'rose-pine-moon', name: 'Rosé Pine Moon', base: 'dark',
    bg: '#232136', chrome: '#1d1b2e', surface: '#2a273f', raised: '#322f4d', overlay: '#3b3859',
    border: '#3b3859', borderStrong: '#4a4670',
    text: '#e0def4', textSec: '#908caa', textMuted: '#6e6a86',
    accent: '#c4a7e7', accentHover: '#d0b8ec', success: '#9ccfd8', danger: '#eb6f92', warning: '#f6c177'
  },
  {
    id: 'everforest-dark', name: 'Everforest Dark', base: 'dark',
    bg: '#2d353b', chrome: '#272e33', surface: '#2d353b', raised: '#374247', overlay: '#414b50',
    border: '#414b50', borderStrong: '#4f5b58',
    text: '#d3c6aa', textSec: '#a6b0a0', textMuted: '#859289',
    accent: '#a7c080', accentHover: '#b8cd98', success: '#a7c080', danger: '#e67e80', warning: '#dbbc7f'
  },
  {
    id: 'kanagawa', name: 'Kanagawa', base: 'dark',
    bg: '#1f1f28', chrome: '#16161d', surface: '#1f1f28', raised: '#2a2a37', overlay: '#363646',
    border: '#363646', borderStrong: '#44445a',
    text: '#dcd7ba', textSec: '#a8a193', textMuted: '#727169',
    accent: '#7e9cd8', accentHover: '#96afe0', success: '#76946a', danger: '#c34043', warning: '#dca561'
  },
  {
    id: 'oceanic-next', name: 'Oceanic Next', base: 'dark',
    bg: '#1b2b34', chrome: '#16252c', surface: '#1b2b34', raised: '#22343d', overlay: '#2b3e48',
    border: '#2b3e48', borderStrong: '#39505b',
    text: '#cdd3de', textSec: '#a0aab5', textMuted: '#65737e',
    accent: '#6699cc', accentHover: '#80aed6', success: '#99c794', danger: '#ec5f67', warning: '#fac863'
  },
  {
    id: 'panda', name: 'Panda', base: 'dark',
    bg: '#292a2b', chrome: '#222324', surface: '#292a2b', raised: '#313334', overlay: '#3d3f40',
    border: '#3d3f40', borderStrong: '#4d4f50',
    text: '#e6e6e6', textSec: '#b0b3b3', textMuted: '#757876',
    accent: '#ff75b5', accentHover: '#ff92c5', success: '#19f9d8', danger: '#ff2c6d', warning: '#ffb86c'
  },
  {
    id: 'horizon', name: 'Horizon', base: 'dark',
    bg: '#1c1e26', chrome: '#16181e', surface: '#1c1e26', raised: '#232530', overlay: '#2e303e',
    border: '#2e303e', borderStrong: '#3d3f52',
    text: '#d5d8da', textSec: '#a3a6ad', textMuted: '#6c6f93',
    accent: '#e95678', accentHover: '#ed7390', success: '#29d398', danger: '#e95678', warning: '#fab795'
  },
  {
    id: 'shades-of-purple', name: 'Shades of Purple', base: 'dark',
    bg: '#2d2b55', chrome: '#1e1e3f', surface: '#2d2b55', raised: '#373463', overlay: '#454275',
    border: '#454275', borderStrong: '#575293',
    text: '#ffffff', textSec: '#c4c2e0', textMuted: '#8e8db8',
    accent: '#fad000', accentHover: '#ffdb33', success: '#3ad900', danger: '#ec3a37', warning: '#ff9d00'
  },
  {
    id: 'zenburn', name: 'Zenburn', base: 'dark',
    bg: '#3f3f3f', chrome: '#383838', surface: '#3f3f3f', raised: '#494949', overlay: '#555555',
    border: '#525252', borderStrong: '#646464',
    text: '#dcdccc', textSec: '#b0b09c', textMuted: '#88886f',
    accent: '#8cd0d3', accentHover: '#a3dadd', success: '#7f9f7f', danger: '#cc9393', warning: '#f0dfaf'
  },
  {
    id: 'spacegray', name: 'Spacegray', base: 'dark',
    bg: '#20242b', chrome: '#1a1d23', surface: '#20242b', raised: '#272b33', overlay: '#31363f',
    border: '#31363f', borderStrong: '#3f4651',
    text: '#c0c5ce', textSec: '#9aa0ab', textMuted: '#65737e',
    accent: '#8fa1b3', accentHover: '#a4b3c2', success: '#a3be8c', danger: '#bf616a', warning: '#ebcb8b'
  },
  {
    id: 'andromeda', name: 'Andromeda', base: 'dark',
    bg: '#23262e', chrome: '#1d2026', surface: '#23262e', raised: '#2b2e37', overlay: '#363a45',
    border: '#363a45', borderStrong: '#464b58',
    text: '#d5ced9', textSec: '#a6a1ad', textMuted: '#746f7b',
    accent: '#00e8c6', accentHover: '#2eecd0', success: '#96e072', danger: '#ee5d43', warning: '#ffe66d'
  },
  {
    id: 'tomorrow-night', name: 'Tomorrow Night', base: 'dark',
    bg: '#1d1f21', chrome: '#181a1b', surface: '#1d1f21', raised: '#282a2e', overlay: '#373b41',
    border: '#373b41', borderStrong: '#4a4f57',
    text: '#c5c8c6', textSec: '#9fa3a0', textMuted: '#727578',
    accent: '#81a2be', accentHover: '#98b5cd', success: '#b5bd68', danger: '#cc6666', warning: '#f0c674'
  },
  {
    id: 'bluloco-dark', name: 'Bluloco Dark', base: 'dark',
    bg: '#282c34', chrome: '#21242b', surface: '#282c34', raised: '#2f343d', overlay: '#3a404a',
    border: '#3a404a', borderStrong: '#4a515d',
    text: '#b9c0cb', textSec: '#919aa6', textMuted: '#636d83',
    accent: '#3476ff', accentHover: '#5a8dff', success: '#3fc56b', danger: '#ff6480', warning: '#f9c859'
  },
  {
    id: 'crab-light', name: 'CrabCode Light', base: 'light',
    bg: '#e8e8e8', chrome: '#dcdcdc', surface: '#e2e2e2', raised: '#d4d4d4', overlay: '#cacaca',
    border: '#c2c2c2', borderStrong: '#aeaeae',
    text: '#1d1d1d', textSec: '#4c4c4c', textMuted: '#6f6f6f',
    accent: '#1a1a1a', accentHover: '#000000'
  },
  {
    id: 'github-light', name: 'GitHub Light', base: 'light',
    bg: '#ffffff', chrome: '#f6f8fa', surface: '#ffffff', raised: '#f6f8fa', overlay: '#eaeef2',
    border: '#d0d7de', borderStrong: '#afb8c1',
    text: '#1f2328', textSec: '#656d76', textMuted: '#8c959f',
    accent: '#0969da', accentHover: '#0860c9', success: '#1a7f37', danger: '#cf222e', warning: '#9a6700'
  },
  {
    id: 'vscode-light', name: 'VS Code Light', base: 'light',
    bg: '#ffffff', chrome: '#f3f3f3', surface: '#ffffff', raised: '#f3f3f3', overlay: '#e8e8e8',
    border: '#e0e0e0', borderStrong: '#c8c8c8',
    text: '#1e1e1e', textSec: '#616161', textMuted: '#8a8a8a',
    accent: '#005fb8', accentHover: '#0078d4'
  },
  {
    id: 'solarized-light', name: 'Solarized Light', base: 'light',
    bg: '#fdf6e3', chrome: '#eee8d5', surface: '#fdf6e3', raised: '#eee8d5', overlay: '#e3ddca',
    border: '#d9d2bf', borderStrong: '#c4bda9',
    text: '#586e75', textSec: '#657b83', textMuted: '#93a1a1',
    accent: '#268bd2', accentHover: '#1f7ec0', success: '#859900', danger: '#dc322f', warning: '#b58900'
  },
  {
    id: 'one-light', name: 'Atom One Light', base: 'light',
    bg: '#fafafa', chrome: '#eaeaeb', surface: '#fafafa', raised: '#eaeaeb', overlay: '#dbdbdc',
    border: '#d4d4d5', borderStrong: '#bcbcbd',
    text: '#383a42', textSec: '#696c77', textMuted: '#a0a1a7',
    accent: '#4078f2', accentHover: '#2f6ae8', success: '#50a14f', danger: '#e45649', warning: '#c18401'
  },
  {
    id: 'ayu-light', name: 'Ayu Light', base: 'light',
    bg: '#fafafa', chrome: '#f3f4f5', surface: '#fafafa', raised: '#f0f0f1', overlay: '#e7e8e9',
    border: '#e0e1e2', borderStrong: '#cacbcc',
    text: '#5c6166', textSec: '#787b80', textMuted: '#a0a4a8',
    accent: '#ff9940', accentHover: '#fa8d2e', success: '#86b300', danger: '#f07171', warning: '#f2ae49'
  },
  {
    id: 'catppuccin-latte', name: 'Catppuccin Latte', base: 'light',
    bg: '#eff1f5', chrome: '#e6e9ef', surface: '#eff1f5', raised: '#dce0e8', overlay: '#ccd0da',
    border: '#ccd0da', borderStrong: '#bcc0cc',
    text: '#4c4f69', textSec: '#5c5f77', textMuted: '#8c8fa1',
    accent: '#1e66f5', accentHover: '#175ce0', success: '#40a02b', danger: '#d20f39', warning: '#df8e1d'
  },
  {
    id: 'rose-pine-dawn', name: 'Rosé Pine Dawn', base: 'light',
    bg: '#faf4ed', chrome: '#fffaf3', surface: '#faf4ed', raised: '#f2e9e1', overlay: '#e9dfd6',
    border: '#dfdad9', borderStrong: '#cecacd',
    text: '#575279', textSec: '#797593', textMuted: '#9893a5',
    accent: '#907aa9', accentHover: '#826a9c', success: '#56949f', danger: '#b4637a', warning: '#ea9d34'
  },
  {
    id: 'gruvbox-light', name: 'Gruvbox Light', base: 'light',
    bg: '#fbf1c7', chrome: '#f2e5bc', surface: '#fbf1c7', raised: '#f2e5bc', overlay: '#ebdbb2',
    border: '#e3d4a7', borderStrong: '#d5c4a1',
    text: '#3c3836', textSec: '#665c54', textMuted: '#928374',
    accent: '#b57614', accentHover: '#a56811', success: '#79740e', danger: '#9d0006', warning: '#af3a03'
  },
  {
    id: 'tokyo-night-light', name: 'Tokyo Night Light', base: 'light',
    bg: '#e1e2e7', chrome: '#d6d8df', surface: '#e1e2e7', raised: '#d0d2da', overlay: '#c4c7d0',
    border: '#c4c7d0', borderStrong: '#b1b5c0',
    text: '#3760bf', textSec: '#6172b0', textMuted: '#8990b3',
    accent: '#2e7de9', accentHover: '#1c6fdd', success: '#587539', danger: '#f52a65', warning: '#8c6c3e'
  },
  {
    id: 'quiet-light', name: 'Quiet Light', base: 'light',
    bg: '#f5f5f5', chrome: '#ececec', surface: '#f5f5f5', raised: '#ececec', overlay: '#e0e0e0',
    border: '#dcdcdc', borderStrong: '#c6c6c6',
    text: '#333333', textSec: '#5c5c5c', textMuted: '#969696',
    accent: '#705697', accentHover: '#634d87', success: '#448c27', danger: '#c72e2e', warning: '#a67d00'
  },
  {
    id: 'min-light', name: 'Min Light', base: 'light',
    bg: '#ffffff', chrome: '#f7f7f7', surface: '#ffffff', raised: '#f2f2f2', overlay: '#e9e9e9',
    border: '#e5e5e5', borderStrong: '#cfcfcf',
    text: '#212121', textSec: '#5e5e5e', textMuted: '#9e9e9e',
    accent: '#1a8fff', accentHover: '#0a82f5'
  },
  {
    id: 'everforest-light', name: 'Everforest Light', base: 'light',
    bg: '#fdf6e3', chrome: '#f4f0d9', surface: '#fdf6e3', raised: '#f0eed9', overlay: '#e6e2cc',
    border: '#e0dcc7', borderStrong: '#cdc9b0',
    text: '#5c6a72', textSec: '#708089', textMuted: '#939f91',
    accent: '#8da101', accentHover: '#7e9001', success: '#8da101', danger: '#f85552', warning: '#dfa000'
  },
  {
    id: 'xcode-light', name: 'Xcode Light', base: 'light',
    bg: '#ffffff', chrome: '#f2f2f7', surface: '#ffffff', raised: '#f2f2f7', overlay: '#e5e5ea',
    border: '#e1e1e6', borderStrong: '#c7c7cc',
    text: '#1d1d1f', textSec: '#5b5b60', textMuted: '#8e8e93',
    accent: '#0a84ff', accentHover: '#0070e0'
  },
  {
    id: 'github-light-high-contrast', name: 'GitHub Light High Contrast', base: 'light',
    bg: '#ffffff', chrome: '#ffffff', surface: '#ffffff', raised: '#f2f2f2', overlay: '#e6e6e6',
    border: '#20252c', borderStrong: '#0e1116',
    text: '#0e1116', textSec: '#373e47', textMuted: '#66707b',
    accent: '#0349b4', accentHover: '#023b94', success: '#055d20', danger: '#a0111f', warning: '#744500'
  },
  {
    id: 'openai-dark', name: 'OpenAI', base: 'dark',
    bg: '#0d0d0d', chrome: '#171717', surface: '#121212', raised: '#1e1e1e', overlay: '#2a2a2a',
    border: '#2b2b2b', borderStrong: '#3b3b3b',
    text: '#ececec', textSec: '#a6a6a6', textMuted: '#6e6e6e',
    accent: '#10a37f', accentHover: '#1cc09a', success: '#10a37f'
  },
  {
    id: 'chatgpt-night', name: 'ChatGPT Night', base: 'dark',
    bg: '#212121', chrome: '#171717', surface: '#2a2a2a', raised: '#323232', overlay: '#3d3d3d',
    border: '#3a3a3a', borderStrong: '#4d4d4d',
    text: '#f3f3f3', textSec: '#b4b4b4', textMuted: '#7d7d7d',
    accent: '#19c37d', accentHover: '#2dd48f'
  },
  {
    id: 'claude-dusk', name: 'Claude Dusk', base: 'dark',
    bg: '#1a1815', chrome: '#211e1a', surface: '#1f1c18', raised: '#2a2620', overlay: '#36302a',
    border: '#34302a', borderStrong: '#473f36',
    text: '#f5f1e8', textSec: '#b3a89a', textMuted: '#7c7264',
    accent: '#d97757', accentHover: '#e89072', warning: '#cc9b5e'
  },
  {
    id: 'gemini-dark', name: 'Gemini', base: 'dark',
    bg: '#131314', chrome: '#1e1f20', surface: '#1b1c1d', raised: '#26282a', overlay: '#303336',
    border: '#303336', borderStrong: '#444a50',
    text: '#e3e3e3', textSec: '#9aa0a6', textMuted: '#6f757b',
    accent: '#8ab4f8', accentHover: '#a6c8fa', danger: '#f28b82', warning: '#fdd663'
  },
  {
    id: 'copilot-dark', name: 'Copilot', base: 'dark',
    bg: '#0d1117', chrome: '#161b22', surface: '#0d1117', raised: '#1c2128', overlay: '#262c36',
    border: '#30363d', borderStrong: '#484f58',
    text: '#e6edf3', textSec: '#8b949e', textMuted: '#6e7681',
    accent: '#a371f7', accentHover: '#b388f9', success: '#3fb950', danger: '#f85149'
  },
  {
    id: 'vercel-dark', name: 'Vercel', base: 'dark',
    bg: '#000000', chrome: '#0a0a0a', surface: '#0a0a0a', raised: '#161616', overlay: '#1f1f1f',
    border: '#222222', borderStrong: '#333333',
    text: '#ededed', textSec: '#a1a1a1', textMuted: '#707070',
    accent: '#ffffff', accentHover: '#ffffff'
  },
  {
    id: 'supabase', name: 'Supabase', base: 'dark',
    bg: '#1c1c1c', chrome: '#171717', surface: '#1c1c1c', raised: '#242424', overlay: '#2e2e2e',
    border: '#2e2e2e', borderStrong: '#3d3d3d',
    text: '#ededed', textSec: '#a0a0a0', textMuted: '#707070',
    accent: '#3ecf8e', accentHover: '#54d99c', success: '#3ecf8e'
  },
  {
    id: 'stripe-dark', name: 'Stripe', base: 'dark',
    bg: '#0a0e27', chrome: '#0d1130', surface: '#11163a', raised: '#1a2048', overlay: '#242c5c',
    border: '#242c5c', borderStrong: '#36406f',
    text: '#e3e8ff', textSec: '#a3acd9', textMuted: '#6d76a8',
    accent: '#635bff', accentHover: '#7a73ff'
  },
  {
    id: 'discord-dark', name: 'Discord', base: 'dark',
    bg: '#313338', chrome: '#2b2d31', surface: '#313338', raised: '#383a40', overlay: '#404249',
    border: '#3f4147', borderStrong: '#4e5058',
    text: '#dbdee1', textSec: '#b5bac1', textMuted: '#949ba4',
    accent: '#5865f2', accentHover: '#6b76f4', success: '#23a55a', danger: '#f23f43'
  },
  {
    id: 'slack-aubergine', name: 'Slack Aubergine', base: 'dark',
    bg: '#1a1d21', chrome: '#19171d', surface: '#1a1d21', raised: '#222529', overlay: '#2c2f33',
    border: '#2c2f33', borderStrong: '#3c3f43',
    text: '#d1d2d3', textSec: '#ababad', textMuted: '#808285',
    accent: '#36c5ab', accentHover: '#4fd3bb', danger: '#e01e5a', warning: '#ecb22e'
  },
  {
    id: 'spotify', name: 'Spotify', base: 'dark',
    bg: '#121212', chrome: '#000000', surface: '#181818', raised: '#242424', overlay: '#2a2a2a',
    border: '#2a2a2a', borderStrong: '#3e3e3e',
    text: '#ffffff', textSec: '#b3b3b3', textMuted: '#7a7a7a',
    accent: '#1db954', accentHover: '#1ed760', success: '#1db954'
  },
  {
    id: 'netflix', name: 'Netflix', base: 'dark',
    bg: '#141414', chrome: '#0b0b0b', surface: '#1a1a1a', raised: '#232323', overlay: '#2d2d2d',
    border: '#2b2b2b', borderStrong: '#3d3d3d',
    text: '#ffffff', textSec: '#b3b3b3', textMuted: '#808080',
    accent: '#e50914', accentHover: '#f6121d', danger: '#e50914'
  },
  {
    id: 'twitch', name: 'Twitch', base: 'dark',
    bg: '#0e0e10', chrome: '#18181b', surface: '#1f1f23', raised: '#26262c', overlay: '#303036',
    border: '#2f2f35', borderStrong: '#3f3f47',
    text: '#efeff1', textSec: '#adadb8', textMuted: '#7d7d87',
    accent: '#9147ff', accentHover: '#a970ff'
  },
  {
    id: 'figma-dark', name: 'Figma', base: 'dark',
    bg: '#1e1e1e', chrome: '#2c2c2c', surface: '#1e1e1e', raised: '#2c2c2c', overlay: '#383838',
    border: '#383838', borderStrong: '#4a4a4a',
    text: '#ffffff', textSec: '#b3b3b3', textMuted: '#808080',
    accent: '#0d99ff', accentHover: '#3aabff', success: '#14ae5c', danger: '#f24822', warning: '#ffcd29'
  },
  {
    id: 'notion-dark', name: 'Notion', base: 'dark',
    bg: '#191919', chrome: '#202020', surface: '#1e1e1e', raised: '#272727', overlay: '#2f2f2f',
    border: '#2e2e2e', borderStrong: '#3f3f3f',
    text: '#ededec', textSec: '#9b9a97', textMuted: '#6f6e6b',
    accent: '#2eaadc', accentHover: '#4cbce4'
  },
  {
    id: 'linear-dark', name: 'Linear', base: 'dark',
    bg: '#101012', chrome: '#161618', surface: '#161618', raised: '#1f1f23', overlay: '#28282d',
    border: '#26262b', borderStrong: '#36363d',
    text: '#f7f8f8', textSec: '#9ca0b0', textMuted: '#6c7086',
    accent: '#5e6ad2', accentHover: '#7480e0'
  },
  {
    id: 'raycast-dark', name: 'Raycast', base: 'dark',
    bg: '#1a1a1a', chrome: '#111111', surface: '#1f1f1f', raised: '#282828', overlay: '#323232',
    border: '#313131', borderStrong: '#424242',
    text: '#f2f2f2', textSec: '#a5a5a5', textMuted: '#6f6f6f',
    accent: '#ff6363', accentHover: '#ff7d7d', danger: '#ff6363'
  },
  {
    id: 'aws-dark', name: 'AWS', base: 'dark',
    bg: '#161e2d', chrome: '#0f1b2d', surface: '#1a2535', raised: '#232f42', overlay: '#2d3a4f',
    border: '#2d3a4f', borderStrong: '#3d4d66',
    text: '#e9ebed', textSec: '#a5b0bd', textMuted: '#717c8a',
    accent: '#ff9900', accentHover: '#ffad33', warning: '#ff9900'
  },
  {
    id: 'azure-dark', name: 'Azure', base: 'dark',
    bg: '#0b1220', chrome: '#0e1626', surface: '#111c30', raised: '#18253d', overlay: '#21304c',
    border: '#21304c', borderStrong: '#314465',
    text: '#e6f1ff', textSec: '#9bb0cc', textMuted: '#6a7d99',
    accent: '#0078d4', accentHover: '#2a90df'
  },
  {
    id: 'firebase', name: 'Firebase', base: 'dark',
    bg: '#1c1b1f', chrome: '#161519', surface: '#211f25', raised: '#2a282f', overlay: '#35323a',
    border: '#34313a', borderStrong: '#46424d',
    text: '#f5f0e8', textSec: '#b6ab9c', textMuted: '#7f7567',
    accent: '#ffca28', accentHover: '#ffd454', warning: '#ffa000', danger: '#f57c00'
  },
  {
    id: 'tailwind-dark', name: 'Tailwind', base: 'dark',
    bg: '#0f172a', chrome: '#0b1120', surface: '#1e293b', raised: '#273449', overlay: '#334155',
    border: '#334155', borderStrong: '#475569',
    text: '#f1f5f9', textSec: '#94a3b8', textMuted: '#64748b',
    accent: '#38bdf8', accentHover: '#5cc8f9', success: '#34d399', danger: '#fb7185', warning: '#fbbf24'
  },
  {
    id: 'postgres', name: 'Postgres', base: 'dark',
    bg: '#0f1b2d', chrome: '#0a1422', surface: '#13233a', raised: '#1b2e49', overlay: '#243a5c',
    border: '#243a5c', borderStrong: '#33507a',
    text: '#e6eef7', textSec: '#9fb3cc', textMuted: '#6b7f99',
    accent: '#336791', accentHover: '#4a82b0'
  },
  {
    id: 'mongodb', name: 'MongoDB', base: 'dark',
    bg: '#001e2b', chrome: '#00141d', surface: '#01283a', raised: '#023248', overlay: '#02415c',
    border: '#02415c', borderStrong: '#0a5878',
    text: '#e8f5e9', textSec: '#9cc5a6', textMuted: '#6a8f74',
    accent: '#00ed64', accentHover: '#3af086', success: '#00ed64'
  },
  {
    id: 'docker', name: 'Docker', base: 'dark',
    bg: '#0a1929', chrome: '#06121f', surface: '#0d2136', raised: '#142b45', overlay: '#1c3858',
    border: '#1c3858', borderStrong: '#2a4d76',
    text: '#e3eefb', textSec: '#9fb6d1', textMuted: '#6b809b',
    accent: '#2496ed', accentHover: '#46aaf0'
  },
  {
    id: 'midnight-blue', name: 'Midnight Blue', base: 'dark',
    bg: '#0b1021', chrome: '#080c1a', surface: '#10162c', raised: '#171f3c', overlay: '#212a4e',
    border: '#212a4e', borderStrong: '#303c6b',
    text: '#dbe2f5', textSec: '#9aa6cc', textMuted: '#677099',
    accent: '#5b8def', accentHover: '#76a3f3'
  },
  {
    id: 'deep-ocean', name: 'Deep Ocean', base: 'dark',
    bg: '#08141a', chrome: '#050e13', surface: '#0c1d25', raised: '#122831', overlay: '#193540',
    border: '#193540', borderStrong: '#264955',
    text: '#d6eef5', textSec: '#92b3bd', textMuted: '#5f7d86',
    accent: '#28c2c8', accentHover: '#48d2d7'
  },
  {
    id: 'carbon', name: 'Carbon', base: 'dark',
    bg: '#161616', chrome: '#0d0d0d', surface: '#1c1c1c', raised: '#262626', overlay: '#303030',
    border: '#2e2e2e', borderStrong: '#404040',
    text: '#f4f4f4', textSec: '#a8a8a8', textMuted: '#6f6f6f',
    accent: '#4589ff', accentHover: '#669cff', danger: '#fa4d56', success: '#42be65'
  },
  {
    id: 'obsidian', name: 'Obsidian', base: 'dark',
    bg: '#0d0d12', chrome: '#101016', surface: '#15151c', raised: '#1d1d26', overlay: '#262630',
    border: '#26262f', borderStrong: '#363641',
    text: '#e8e8ee', textSec: '#a0a0b0', textMuted: '#6b6b7c',
    accent: '#a882ff', accentHover: '#bb9cff'
  },
  {
    id: 'crimson-night', name: 'Crimson Night', base: 'dark',
    bg: '#160d0f', chrome: '#1d1012', surface: '#1c1214', raised: '#27181b', overlay: '#352024',
    border: '#33201f', borderStrong: '#4a2d2c',
    text: '#f5e4e6', textSec: '#c69ba0', textMuted: '#8d6468',
    accent: '#e23d5c', accentHover: '#ec5d77', danger: '#e23d5c'
  },
  {
    id: 'emerald-night', name: 'Emerald Night', base: 'dark',
    bg: '#0a1612', chrome: '#071b14', surface: '#0e1f19', raised: '#142a22', overlay: '#1c372d',
    border: '#1c372d', borderStrong: '#2a4d3f',
    text: '#dff5ea', textSec: '#94c7ab', textMuted: '#628f76',
    accent: '#2bd4a0', accentHover: '#4bdfb2', success: '#2bd4a0'
  },
  {
    id: 'amethyst', name: 'Amethyst', base: 'dark',
    bg: '#150f1e', chrome: '#100b18', surface: '#1b1426', raised: '#241b33', overlay: '#2f2442',
    border: '#2e2342', borderStrong: '#41335c',
    text: '#ece3f7', textSec: '#b3a0cc', textMuted: '#7e6b99',
    accent: '#b06bff', accentHover: '#c187ff'
  },
  {
    id: 'sunset-dark', name: 'Sunset', base: 'dark',
    bg: '#1a1015', chrome: '#21141a', surface: '#22151c', raised: '#2f1e26', overlay: '#3d2832',
    border: '#3a2630', borderStrong: '#523642',
    text: '#fbe8e0', textSec: '#cfa599', textMuted: '#977166',
    accent: '#ff7a59', accentHover: '#ff9576', warning: '#ffb454'
  },
  {
    id: 'matrix', name: 'Matrix', base: 'dark',
    bg: '#0a0f0a', chrome: '#060a06', surface: '#0e150e', raised: '#141e14', overlay: '#1b291b',
    border: '#1b291b', borderStrong: '#294029',
    text: '#c8facb', textSec: '#7fbf82', textMuted: '#4f7f52',
    accent: '#00ff66', accentHover: '#4dff94', success: '#00ff66'
  },
  {
    id: 'amber-terminal', name: 'Amber Terminal', base: 'dark',
    bg: '#120d05', chrome: '#0d0904', surface: '#181006', raised: '#22170a', overlay: '#2e1f0e',
    border: '#2e1f0e', borderStrong: '#443015',
    text: '#ffcf8f', textSec: '#c79a5e', textMuted: '#8f6c3f',
    accent: '#ffb000', accentHover: '#ffc333', warning: '#ffb000'
  },
  {
    id: 'mono-noir', name: 'Mono Noir', base: 'dark',
    bg: '#0a0a0a', chrome: '#101010', surface: '#141414', raised: '#1c1c1c', overlay: '#262626',
    border: '#262626', borderStrong: '#3a3a3a',
    text: '#fafafa', textSec: '#9e9e9e', textMuted: '#666666',
    accent: '#fafafa', accentHover: '#ffffff'
  },
  {
    id: 'slate-pro', name: 'Slate Pro', base: 'dark',
    bg: '#0f1419', chrome: '#0b0f14', surface: '#151b22', raised: '#1d2530', overlay: '#27313e',
    border: '#27313e', borderStrong: '#374555',
    text: '#e4e9f0', textSec: '#9aa6b5', textMuted: '#677484',
    accent: '#5e8bc4', accentHover: '#79a2d4'
  },
  {
    id: 'royal-purple', name: 'Royal Purple', base: 'dark',
    bg: '#13101f', chrome: '#0f0c18', surface: '#191428', raised: '#221b36', overlay: '#2e2547',
    border: '#2d2447', borderStrong: '#403461',
    text: '#e9e2fb', textSec: '#a99cce', textMuted: '#74679a',
    accent: '#7c5cff', accentHover: '#9379ff'
  },
  {
    id: 'forest-deep', name: 'Forest Deep', base: 'dark',
    bg: '#0d140f', chrome: '#0a100c', surface: '#121d16', raised: '#19271e', overlay: '#223328',
    border: '#223328', borderStrong: '#32493b',
    text: '#def0e3', textSec: '#9cc1a7', textMuted: '#688a73',
    accent: '#5fb878', accentHover: '#7cc991', success: '#5fb878'
  },
  {
    id: 'graphite', name: 'Graphite', base: 'dark',
    bg: '#1b1d1e', chrome: '#151718', surface: '#212425', raised: '#2a2e2f', overlay: '#353a3b',
    border: '#34393a', borderStrong: '#474d4e',
    text: '#e8eaeb', textSec: '#a4a9ab', textMuted: '#6e7375',
    accent: '#7fb4c4', accentHover: '#9bc6d3'
  },
  {
    id: 'neon-cyber', name: 'Neon Cyber', base: 'dark',
    bg: '#0a0a12', chrome: '#070710', surface: '#10101e', raised: '#171729', overlay: '#202037',
    border: '#202037', borderStrong: '#2f2f52',
    text: '#e6f0ff', textSec: '#8fa3c9', textMuted: '#5d6e94',
    accent: '#00e5ff', accentHover: '#4deeff', danger: '#ff2a6d', warning: '#ffd319'
  },
  {
    id: 'vaporwave', name: 'Vaporwave', base: 'dark',
    bg: '#1a1033', chrome: '#150c2a', surface: '#21163f', raised: '#2c1f50', overlay: '#392a64',
    border: '#392a64', borderStrong: '#4f3d83',
    text: '#f2e6ff', textSec: '#c2a8e0', textMuted: '#8a72ad',
    accent: '#ff71ce', accentHover: '#ff8fd8', success: '#05ffa1', warning: '#fffb96'
  },
  {
    id: 'coffee', name: 'Coffee', base: 'dark',
    bg: '#1a1410', chrome: '#140f0b', surface: '#211a14', raised: '#2c231b', overlay: '#382e24',
    border: '#372d23', borderStrong: '#4d4032',
    text: '#f0e6da', textSec: '#bfae9b', textMuted: '#897a69',
    accent: '#c8966a', accentHover: '#d6aa83', warning: '#d6a35c'
  },
  {
    id: 'rose-noir', name: 'Rose Noir', base: 'dark',
    bg: '#16101a', chrome: '#110c14', surface: '#1d1522', raised: '#271c2e', overlay: '#33263c',
    border: '#32253b', borderStrong: '#473553',
    text: '#f3e6f0', textSec: '#c4a3bb', textMuted: '#8d6c84',
    accent: '#f06ba8', accentHover: '#f388bb'
  },
  {
    id: 'arctic-dark', name: 'Arctic', base: 'dark',
    bg: '#11161c', chrome: '#0d1116', surface: '#171e26', raised: '#1f2832', overlay: '#293541',
    border: '#293541', borderStrong: '#394858',
    text: '#e8eef5', textSec: '#a3b1c2', textMuted: '#6f7d8e',
    accent: '#7fd6e8', accentHover: '#9be0ef'
  },
  {
    id: 'volcano', name: 'Volcano', base: 'dark',
    bg: '#15100e', chrome: '#0f0b09', surface: '#1c1411', raised: '#271b16', overlay: '#34241d',
    border: '#33231c', borderStrong: '#4b342a',
    text: '#f7e7df', textSec: '#cba294', textMuted: '#937065',
    accent: '#ff5722', accentHover: '#ff7043', warning: '#ff9800', danger: '#f4511e'
  },
  {
    id: 'teal-night', name: 'Teal Night', base: 'dark',
    bg: '#0c1718', chrome: '#081112', surface: '#11201f', raised: '#182b2a', overlay: '#203938',
    border: '#203938', borderStrong: '#2f504e',
    text: '#dcf2f0', textSec: '#94c4c0', textMuted: '#618c88',
    accent: '#2dd4bf', accentHover: '#4ddecb', success: '#2dd4bf'
  },
  {
    id: 'indigo-pro', name: 'Indigo Pro', base: 'dark',
    bg: '#0e1020', chrome: '#0a0c1a', surface: '#14172b', raised: '#1c2039', overlay: '#262c4b',
    border: '#262c4b', borderStrong: '#373f68',
    text: '#e4e7f5', textSec: '#9ba3cc', textMuted: '#686f99',
    accent: '#818cf8', accentHover: '#9ba4fa'
  },
  {
    id: 'blood-moon', name: 'Blood Moon', base: 'dark',
    bg: '#120a0a', chrome: '#0d0707', surface: '#190d0d', raised: '#231313', overlay: '#301a1a',
    border: '#2e1919', borderStrong: '#452626',
    text: '#f3dede', textSec: '#c39595', textMuted: '#8a6262',
    accent: '#dc2626', accentHover: '#e84545', danger: '#dc2626'
  },
  {
    id: 'gold-luxe', name: 'Gold Luxe', base: 'dark',
    bg: '#13110a', chrome: '#0e0c06', surface: '#1a170d', raised: '#252013', overlay: '#322b1a',
    border: '#312a19', borderStrong: '#473d26',
    text: '#f5efdc', textSec: '#c7ba94', textMuted: '#8f8463',
    accent: '#d4af37', accentHover: '#e0c155', warning: '#d4af37'
  },
  {
    id: 'steel-blue', name: 'Steel Blue', base: 'dark',
    bg: '#10151a', chrome: '#0c1014', surface: '#161d24', raised: '#1f2831', overlay: '#29343f',
    border: '#29343f', borderStrong: '#3a4855',
    text: '#e3eaf1', textSec: '#9fafbe', textMuted: '#6b7a89',
    accent: '#4f9cd9', accentHover: '#6fb0e3'
  },
  {
    id: 'mint-dark', name: 'Mint Dark', base: 'dark',
    bg: '#0d1714', chrome: '#0a1310', surface: '#11201b', raised: '#182b24', overlay: '#21392f',
    border: '#21392f', borderStrong: '#315044',
    text: '#dcf5ea', textSec: '#95c8b3', textMuted: '#629079',
    accent: '#4ade80', accentHover: '#6ee79b', success: '#4ade80'
  },
  {
    id: 'plum-dark', name: 'Plum', base: 'dark',
    bg: '#160f17', chrome: '#110b12', surface: '#1d141f', raised: '#281c2a', overlay: '#352637',
    border: '#332435', borderStrong: '#49344c',
    text: '#f1e5f2', textSec: '#bfa3c2', textMuted: '#896c8c',
    accent: '#c44dd6', accentHover: '#d06ddf'
  },
  {
    id: 'ash', name: 'Ash', base: 'dark',
    bg: '#18191b', chrome: '#121315', surface: '#1e2022', raised: '#27292c', overlay: '#313438',
    border: '#303336', borderStrong: '#42454a',
    text: '#e7e9ec', textSec: '#a3a8af', textMuted: '#6d7178',
    accent: '#9aa7b5', accentHover: '#b2bdc9'
  },
  {
    id: 'sapphire', name: 'Sapphire', base: 'dark',
    bg: '#0a0f1f', chrome: '#070b18', surface: '#0f1629', raised: '#161f3a', overlay: '#1f2b4d',
    border: '#1f2b4d', borderStrong: '#2e3e6e',
    text: '#dde6fb', textSec: '#97a8d4', textMuted: '#63729e',
    accent: '#2563eb', accentHover: '#3b78f0'
  },
  {
    id: 'charcoal-warm', name: 'Charcoal Warm', base: 'dark',
    bg: '#1a1817', chrome: '#141211', surface: '#211e1c', raised: '#2b2724', overlay: '#36312d',
    border: '#34302c', borderStrong: '#48423c',
    text: '#eee9e3', textSec: '#aaa49b', textMuted: '#736d64',
    accent: '#e6a15c', accentHover: '#edb478', warning: '#e6a15c'
  },
  {
    id: 'cyber-lime', name: 'Cyber Lime', base: 'dark',
    bg: '#0d1108', chrome: '#090c05', surface: '#13180c', raised: '#1c2212', overlay: '#262e1a',
    border: '#262e1a', borderStrong: '#3a4628',
    text: '#e9f5d6', textSec: '#b0c592', textMuted: '#7c8f5f',
    accent: '#a3e635', accentHover: '#b7ec5e', success: '#a3e635'
  },
  {
    id: 'deep-space', name: 'Deep Space', base: 'dark',
    bg: '#08080f', chrome: '#05050b', surface: '#0d0d18', raised: '#141423', overlay: '#1d1d31',
    border: '#1c1c30', borderStrong: '#2a2a47',
    text: '#dde0f0', textSec: '#9498bf', textMuted: '#61648a',
    accent: '#6d5dfc', accentHover: '#8678fd'
  },
  {
    id: 'wine', name: 'Wine', base: 'dark',
    bg: '#160b10', chrome: '#11080c', surface: '#1d1016', raised: '#28171f', overlay: '#352029',
    border: '#331e27', borderStrong: '#4a2d39',
    text: '#f4e2eb', textSec: '#c498ab', textMuted: '#8d6477',
    accent: '#be185d', accentHover: '#d23b78'
  },
  {
    id: 'pine', name: 'Pine', base: 'dark',
    bg: '#0b1413', chrome: '#080f0e', surface: '#111d1b', raised: '#182824', overlay: '#20352f',
    border: '#20352f', borderStrong: '#2f4c43',
    text: '#daf0ea', textSec: '#92c2b6', textMuted: '#5f8a7d',
    accent: '#14b8a6', accentHover: '#2dccba', success: '#14b8a6'
  },
  {
    id: 'cocoa', name: 'Cocoa', base: 'dark',
    bg: '#19120e', chrome: '#130d0a', surface: '#201814', raised: '#2b211b', overlay: '#382c24',
    border: '#372b23', borderStrong: '#4d3d31',
    text: '#f0e4d8', textSec: '#bfac99', textMuted: '#897a68',
    accent: '#b5824e', accentHover: '#c69968'
  },
  {
    id: 'electric-violet', name: 'Electric Violet', base: 'dark',
    bg: '#0f0a1a', chrome: '#0b0714', surface: '#150e24', raised: '#1e1532', overlay: '#291d44',
    border: '#281c43', borderStrong: '#3a2a61',
    text: '#ebe3fb', textSec: '#ab9bd6', textMuted: '#7363a0',
    accent: '#8b5cf6', accentHover: '#a178f8'
  },
  {
    id: 'inferno', name: 'Inferno', base: 'dark',
    bg: '#140a08', chrome: '#0e0705', surface: '#1c0f0b', raised: '#281611', overlay: '#371f17',
    border: '#351d16', borderStrong: '#4e2d22',
    text: '#fbe6da', textSec: '#cd9f8c', textMuted: '#956d5c',
    accent: '#f97316', accentHover: '#fb8c3c', danger: '#ef4444', warning: '#f59e0b'
  },
  {
    id: 'glacier', name: 'Glacier', base: 'dark',
    bg: '#0d141a', chrome: '#0a1015', surface: '#131d25', raised: '#1b2832', overlay: '#243441',
    border: '#243441', borderStrong: '#344a59',
    text: '#e2eef5', textSec: '#9bb4c4', textMuted: '#66808f',
    accent: '#38bdf8', accentHover: '#5fcbf9'
  },
  {
    id: 'olive-dark', name: 'Olive', base: 'dark',
    bg: '#13140c', chrome: '#0e0f08', surface: '#1a1c12', raised: '#24271a', overlay: '#303323',
    border: '#2f3222', borderStrong: '#444834',
    text: '#eef0dd', textSec: '#b6ba96', textMuted: '#828564',
    accent: '#b3c95b', accentHover: '#c4d77c'
  },
  {
    id: 'magenta-dream', name: 'Magenta Dream', base: 'dark',
    bg: '#160a14', chrome: '#11070f', surface: '#1e0f1b', raised: '#2a1726', overlay: '#382032',
    border: '#36202f', borderStrong: '#4e2f44',
    text: '#f6e2f0', textSec: '#cc99bc', textMuted: '#946487',
    accent: '#ec4899', accentHover: '#f067aa'
  },
  {
    id: 'navy-pro', name: 'Navy Pro', base: 'dark',
    bg: '#0a0e1a', chrome: '#070a14', surface: '#101524', raised: '#171e33', overlay: '#202945',
    border: '#202945', borderStrong: '#2f3b63',
    text: '#dfe5f2', textSec: '#97a3c4', textMuted: '#646f94',
    accent: '#3b82f6', accentHover: '#5b97f8'
  },
  {
    id: 'jade', name: 'Jade', base: 'dark',
    bg: '#0a1512', chrome: '#06100d', surface: '#0f1f1a', raised: '#152a23', overlay: '#1d382f',
    border: '#1d382f', borderStrong: '#2b4f43',
    text: '#dcf3ea', textSec: '#92c7b1', textMuted: '#5e8e79',
    accent: '#10b981', accentHover: '#2fcd97', success: '#10b981'
  },
  {
    id: 'ember', name: 'Ember', base: 'dark',
    bg: '#16100c', chrome: '#100b08', surface: '#1d1611', raised: '#281e17', overlay: '#352920',
    border: '#33271e', borderStrong: '#4a392c',
    text: '#f5e8dc', textSec: '#c8ac94', textMuted: '#917a66',
    accent: '#fb923c', accentHover: '#fca85f', warning: '#fbbf24'
  },
  {
    id: 'twilight-purple', name: 'Twilight', base: 'dark',
    bg: '#0f0d1a', chrome: '#0b0914', surface: '#161324', raised: '#1f1b33', overlay: '#2a2545',
    border: '#292444', borderStrong: '#3b3463',
    text: '#e7e3f5', textSec: '#a59ecc', textMuted: '#6f6899',
    accent: '#a78bfa', accentHover: '#bba3fb'
  },
  {
    id: 'onyx', name: 'Onyx', base: 'dark',
    bg: '#0c0c0e', chrome: '#08080a', surface: '#121214', raised: '#1a1a1e', overlay: '#232328',
    border: '#222227', borderStrong: '#34343b',
    text: '#eaeaee', textSec: '#9d9da8', textMuted: '#666670',
    accent: '#60a5fa', accentHover: '#7db4fb'
  },
  {
    id: 'cherry-dark', name: 'Cherry', base: 'dark',
    bg: '#170c0f', chrome: '#120809', surface: '#1f1014', raised: '#2b181d', overlay: '#392127',
    border: '#371f25', borderStrong: '#4f2e36',
    text: '#f6e3e7', textSec: '#cb98a2', textMuted: '#936670',
    accent: '#f43f5e', accentHover: '#f6617a', danger: '#f43f5e'
  },
  {
    id: 'lagoon', name: 'Lagoon', base: 'dark',
    bg: '#08161c', chrome: '#051016', surface: '#0d2129', raised: '#142d36', overlay: '#1c3c47',
    border: '#1c3c47', borderStrong: '#2a5563',
    text: '#dbf0f5', textSec: '#90bcc6', textMuted: '#5d8590',
    accent: '#06b6d4', accentHover: '#22c7e3'
  },
  {
    id: 'mocha-cream', name: 'Mocha Cream', base: 'dark',
    bg: '#1c1714', chrome: '#15110f', surface: '#241e1a', raised: '#2f2823', overlay: '#3b332c',
    border: '#39312a', borderStrong: '#4f453b',
    text: '#f1e9e0', textSec: '#bdae9f', textMuted: '#88796a',
    accent: '#d6a780', accentHover: '#e0b896'
  },
  {
    id: 'iris', name: 'Iris', base: 'dark',
    bg: '#0d0e1c', chrome: '#090a16', surface: '#131527', raised: '#1b1d37', overlay: '#252849',
    border: '#252849', borderStrong: '#363a68',
    text: '#e5e6f7', textSec: '#9da0cf', textMuted: '#686c9c',
    accent: '#6366f1', accentHover: '#7e80f4'
  },
  {
    id: 'paper-light', name: 'Paper', base: 'light',
    bg: '#fbfbf9', chrome: '#f2f1ec', surface: '#fbfbf9', raised: '#f2f1ec', overlay: '#e7e6df',
    border: '#e3e2da', borderStrong: '#cbcabf',
    text: '#2b2a26', textSec: '#5e5c54', textMuted: '#928f84',
    accent: '#3b82f6', accentHover: '#2f73e6'
  },
  {
    id: 'notion-light', name: 'Notion Light', base: 'light',
    bg: '#ffffff', chrome: '#f7f7f5', surface: '#ffffff', raised: '#f1f1ef', overlay: '#e9e9e7',
    border: '#e3e3e0', borderStrong: '#cfcfca',
    text: '#37352f', textSec: '#6b6a64', textMuted: '#9b9a93',
    accent: '#2eaadc', accentHover: '#1f97c7'
  },
  {
    id: 'linear-light', name: 'Linear Light', base: 'light',
    bg: '#ffffff', chrome: '#f4f5f8', surface: '#ffffff', raised: '#f4f5f8', overlay: '#eceef2',
    border: '#e5e7eb', borderStrong: '#cfd3da',
    text: '#1d1f24', textSec: '#5b6069', textMuted: '#8a8f99',
    accent: '#5e6ad2', accentHover: '#4f5cc4'
  },
  {
    id: 'sand-light', name: 'Sand', base: 'light',
    bg: '#f6f1e7', chrome: '#efe8da', surface: '#f6f1e7', raised: '#ece4d3', overlay: '#e0d6c1',
    border: '#ddd3bf', borderStrong: '#c7bca4',
    text: '#3a3326', textSec: '#675e4c', textMuted: '#968b76',
    accent: '#c0843e', accentHover: '#ac7333', warning: '#c0843e'
  },
  {
    id: 'rose-light', name: 'Rose Light', base: 'light',
    bg: '#fdf2f6', chrome: '#fbe7ee', surface: '#fdf2f6', raised: '#f8e0ea', overlay: '#f2d2e0',
    border: '#f0cfdd', borderStrong: '#e0adc2',
    text: '#3d2531', textSec: '#6e4f5d', textMuted: '#a07f8d',
    accent: '#e11d72', accentHover: '#cc1666'
  },
  {
    id: 'mint-light', name: 'Mint Light', base: 'light',
    bg: '#f1faf5', chrome: '#e4f3ec', surface: '#f1faf5', raised: '#dcefe4', overlay: '#cde8d8',
    border: '#cce6d8', borderStrong: '#aed3bf',
    text: '#1f3a2c', textSec: '#4a6657', textMuted: '#7a9686',
    accent: '#0e9f6e', accentHover: '#0c8c61', success: '#0e9f6e'
  },
  {
    id: 'sky-light', name: 'Sky Light', base: 'light',
    bg: '#f3f9ff', chrome: '#e6f2fd', surface: '#f3f9ff', raised: '#ddecfb', overlay: '#cee2f7',
    border: '#cfe2f5', borderStrong: '#aec9e8',
    text: '#13314f', textSec: '#3f5a78', textMuted: '#7089a5',
    accent: '#0284c7', accentHover: '#0273ad'
  },
  {
    id: 'lavender-light', name: 'Lavender Light', base: 'light',
    bg: '#f7f5fd', chrome: '#efeafa', surface: '#f7f5fd', raised: '#e9e2f7', overlay: '#ddd3f0',
    border: '#ddd4f0', borderStrong: '#c3b4e2',
    text: '#2d2440', textSec: '#574b70', textMuted: '#8a7da3',
    accent: '#7c3aed', accentHover: '#6d2fd6'
  }
]

export const THEMES: ThemeDef[] = SPECS.map(expand)

export const THEME_MAP: Record<string, ThemeDef> = Object.fromEntries(
  THEMES.map((t) => [t.id, t])
)

export function getThemeDef(id: string): ThemeDef {
  return THEME_MAP[id] ?? THEME_MAP['crab-dark']
}

export interface XtermTheme {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export function xtermThemeFor(id: string): XtermTheme {
  const def = getThemeDef(id)
  const v = def.vars
  const light = def.base === 'light'
  const accent = v['--color-accent']
  return {
    background: v['--color-bg'],
    foreground: v['--color-text'],
    cursor: accent,
    cursorAccent: v['--color-bg'],
    selectionBackground: light ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.20)',
    black: light ? '#2a2a2a' : '#000000',
    red: v['--color-danger'],
    green: v['--color-success'],
    yellow: v['--color-warning'],
    blue: accent,
    magenta: light ? '#a347d1' : '#b06dff',
    cyan: light ? '#0a8aa0' : '#56b6c2',
    white: v['--color-text-secondary'],
    brightBlack: v['--color-text-muted'],
    brightRed: v['--color-danger'],
    brightGreen: v['--color-success'],
    brightYellow: v['--color-warning'],
    brightBlue: v['--color-accent-hover'],
    brightMagenta: light ? '#bb5ee0' : '#c79bff',
    brightCyan: light ? '#1aa0b8' : '#7cc8d3',
    brightWhite: v['--color-text']
  }
}
