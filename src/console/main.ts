import { mount } from 'svelte'
import '../styles/fonts.css'
import '../styles/base.css'
import '../styles/console.css'
import Console from './Console.svelte'

const app = mount(Console, { target: document.getElementById('app')! })

export default app
