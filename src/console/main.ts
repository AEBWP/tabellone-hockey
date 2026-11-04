import { mount } from 'svelte'
import '../styles/base.css'
import Console from './Console.svelte'

const app = mount(Console, { target: document.getElementById('app')! })

export default app
