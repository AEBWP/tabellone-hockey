import { mount } from 'svelte'
import '../styles/fonts.css'
import '../styles/base.css'
import { preloadFonts } from '../styles/preload-fonts'
import '../styles/console.css'
import Console from './Console.svelte'

preloadFonts()

const app = mount(Console, { target: document.getElementById('app')! })

export default app
