export function initRangeSliders(): void {
  function showValue(input: HTMLInputElement): void {
    const parent = input.parentElement!;
    parent.querySelector('.value')!.textContent = input.value;
  }

  const ranges = document.querySelectorAll<HTMLInputElement>('input[type="range"]');

  ranges.forEach((input) => {
    input.addEventListener('change', () => showValue(input));
    input.addEventListener('input', () => showValue(input));
    showValue(input);
  });
}
