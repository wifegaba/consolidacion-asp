'use client'
import { ClickToComponent } from 'click-to-react-component'

export default function ClickToComponentClient() {
  if (process.env.NODE_ENV !== 'development') return null
  return <ClickToComponent editor="vscode" />
}
