import { mount } from 'svelte'
import '../styles/fonts.css'
import '../styles/base.css'
import Display from './Display.svelte'

const app = mount(Display, { target: document.getElementById('app')! })

export default app
