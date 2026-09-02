(() => {
  if (window.__elementIdPickerInjected) return;
  window.__elementIdPickerInjected = true;

  const HIGHLIGHT_CLASS = "eip-highlight";
  const TOAST_ID = "eip-toast";

  let active = false;
  let currentTarget = null;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "EIP_TOGGLE_PICKER") {
      setActive(Boolean(message.active));
    }
  });

  function setActive(next) {
    if (active === next) return;
    active = next;
    if (active) {
      document.addEventListener("mouseover", onMouseOver, true);
      document.addEventListener("mouseout", onMouseOut, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      document.body?.classList.add("eip-picking");
    } else {
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("mouseout", onMouseOut, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body?.classList.remove("eip-picking");
      clearHighlight();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      setActive(false);
      chrome.runtime.sendMessage({ type: "EIP_FORCE_OFF" }).catch(() => {});
    }
  }

  function onMouseOver(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target === currentTarget) return;
    clearHighlight();
    currentTarget = target;
    target.classList.add(HIGHLIGHT_CLASS);
  }

  function onMouseOut(e) {
    if (e.target === currentTarget) {
      clearHighlight();
    }
  }

  function clearHighlight() {
    if (currentTarget) {
      currentTarget.classList.remove(HIGHLIGHT_CLASS);
      currentTarget = null;
    }
  }

  function onClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const info = describeElement(target);
    copyToClipboard(info)
      .then(() => showToast("コピーしました"))
      .catch(() => showToast("コピーに失敗しました", true));
  }

  // 表示中のビューポート幅からおおよそのデバイス種別を判定する。
  function classifyViewport(width) {
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  }

  function describeViewport() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const kind = classifyViewport(width);
    return `${width}x${height} (${kind}, dpr=${dpr})`;
  }

  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const classList = Array.from(el.classList).filter((c) => c !== HIGHLIGHT_CLASS);
    const selector = buildUniqueSelector(el);
    const domPath = buildDomPath(el);
    const reactInfo = describeReactComponent(el);
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
    const attrs = Array.from(el.attributes)
      .filter((a) => a.name !== "class" && a.name !== "id")
      .map((a) => `${a.name}="${a.value}"`)
      .join(" ");
    const outerHtmlOpenTag = el.outerHTML.split(">")[0] + ">";

    const lines = [];
    lines.push("## Element picked (Element ID Picker)");
    lines.push("");
    lines.push(`Viewport: ${describeViewport()}`);
    lines.push(`Selector: \`${selector}\``);
    lines.push(`Tag: ${tag}${id}`);
    lines.push(`Classes: ${classList.length ? classList.join(", ") : "(none)"}`);
    if (attrs) lines.push(`Attributes: ${attrs}`);
    if (reactInfo) lines.push(`React component: ${reactInfo}`);
    if (text) lines.push(`Text: "${text}"`);
    lines.push(`DOM path: ${domPath}`);
    lines.push(`Open tag: ${outerHtmlOpenTag}`);

    return lines.join("\n");
  }

  // id や data-testid があれば優先し、なければ tag+class+nth-of-type で
  // ルートまで遡って一意になるセレクタを組み立てる。
  function buildUniqueSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;

    const testId = el.getAttribute("data-testid");
    if (testId) return `[data-testid="${testId}"]`;

    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part = `#${CSS.escape(node.id)}`;
        parts.unshift(part);
        break;
      }
      const classes = Array.from(node.classList).filter((c) => c !== HIGHLIGHT_CLASS);
      if (classes.length) {
        part += "." + classes.slice(0, 2).map((c) => CSS.escape(c)).join(".");
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (sib) => sib.tagName === node.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(node) + 1;
          part += `:nth-of-type(${index})`;
        }
      }
      parts.unshift(part);
      node = node.parentElement;

      // 十分に絞り込めていれば深追いしない。
      if (parts.length >= 4 && document.querySelectorAll(parts.join(" > ")).length === 1) {
        break;
      }
    }
    return parts.join(" > ");
  }

  function buildDomPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      let part = node.tagName.toLowerCase();
      if (node.id) part += `#${node.id}`;
      const classes = Array.from(node.classList).filter((c) => c !== HIGHLIGHT_CLASS);
      if (classes.length) part += `.${classes[0]}`;
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  // React が付与する内部プロパティ（__reactFiber$xxx など）を辿り、
  // 最初に見つかる「関数/クラスコンポーネント」の表示名を推測する。
  function describeReactComponent(el) {
    const key = Object.keys(el).find(
      (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
    );
    if (!key) return null;

    let fiber = el[key];
    let depth = 0;
    while (fiber && depth < 30) {
      const type = fiber.type;
      if (typeof type === "function") {
        const name = type.displayName || type.name;
        if (name) return name;
      } else if (type && typeof type === "object" && type.displayName) {
        return type.displayName;
      }
      fiber = fiber.return;
      depth += 1;
    }
    return null;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      // clipboard API が使えない環境向けのフォールバック。
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) throw err;
    }
  }

  function showToast(message, isError = false) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.documentElement.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle("eip-toast-error", isError);
    toast.classList.add("eip-toast-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove("eip-toast-visible");
    }, 1400);
  }
})();
