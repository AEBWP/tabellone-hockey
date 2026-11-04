import { mount } from 'svelte'
import '../styles/base.css'
import '../styles/console.css'
import Setup from './Setup.svelte'

const app = mount(Setup, { target: document.getElementById('app')! })

export default app
