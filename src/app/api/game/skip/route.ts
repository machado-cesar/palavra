import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Funcionalidade removida' }, { status: 410 })
}
