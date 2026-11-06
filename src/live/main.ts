import { mount } from 'svelte'
import '../styles/fonts.css'
import '../styles/base.css'
import { preloadFonts } from '../styles/preload-fonts'
import Live from './Live.svelte'

preloadFonts()

const app = mount(Live, { target: document.getElementById('app')! })

export default app
