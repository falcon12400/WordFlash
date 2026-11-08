// Reliable taps on phones and iPads: answer on touch release, then ignore the
// click the browser generates right after it. Mouse and keyboard use click.
// Same rule as answerWithTouchSupport() in canvas_words.html.

export function onTap(element, handler) {
  let lastTouchAt = 0;
  element.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    event.preventDefault();
    lastTouchAt = Date.now();
    handler(event);
  });
  element.addEventListener("click", (event) => {
    if (event.detail !== 0 && Date.now() - lastTouchAt < 750) return;
    handler(event);
  });
}
