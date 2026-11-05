import { mount } from 'svelte'
import '../styles/fonts.css'
import '../styles/base.css'
import { preloadFonts } from '../styles/preload-fonts'
import Display from './Display.svelte'

preloadFonts()

const app = mount(Display, { target: document.getElementById('app')! })

export default app
