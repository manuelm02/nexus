// TranslateHeader 只负责标题区，不再展示 provider ready 或 provider checking 状态，避免正常状态抢占注意力。
export function TranslateHeader() {
  return (
    <header>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Translate</p>
      <h1 className="mt-1 text-3xl font-black leading-tight text-foreground md:text-[32px]">轻量翻译工作台</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">同一个意思，换一种语言，你会看见它不同的棱角。</p>
    </header>
  )
}
