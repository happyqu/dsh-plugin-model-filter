/**
 * dsh-plugin-model-filter — Client half.
 *
 * The composer model seat (`conversation.input.model`) is a `single` slot, and
 * a single slot renders its LOWEST-priority live entry. This module therefore
 * registers the same seat at `priority: -1`, which shadows the shipped
 * `ModelSelect` without touching it, and renders a faithful copy of that
 * control with one addition: a filter box over the provider-grouped model list.
 *
 * Why a shadow and not an additive control: the seat is one cell, and the list
 * the filter must narrow lives inside the shipped component's portal menu. No
 * weaker extension point can reach into it, so the filtered list has to BE the
 * seat's occupant.
 *
 * Data and submission ride the same shared per-session ModelDirectory the
 * shipped selector and the `/model` popup use (`ctx.modelDirectories`), so a
 * switch made here is what those entries show next. Nothing is re-implemented
 * on the Host side.
 *
 * Styling follows the shipped component: its own CSS is copied here with a
 * `_dshmf_` prefix and the same `--dsw-*` theme tokens. Harness Client packages
 * are deliberately NOT imported (only React from the browser module table), so
 * the primitives this control needs — the menu material, the state dot, the
 * toast, and the icon artwork — are copied locally.
 */
window.__ModuleLoader__.load({
  id: "dsh-plugin-model-filter",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");
    var ReactDOM = require("react-dom");
    var h = React.createElement;
    var Fragment = React.Fragment;

    /** Dictionary namespace owned by this plugin. */
    var NS = "modelFilter";

    /** Simplified Chinese dictionary (the key-set source of truth). */
    var zh = {
      "provider.account": "DeepSeek 账号",
      "trigger.fallback": "请选择模型",
      "trigger.loading": "正在加载模型…",
      "trigger.selectAria": "请选择模型",
      "trigger.aria": "选择模型，当前 {model}",
      "trigger.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
      "menu.aria": "模型与推理等级",
      "menu.model": "模型",
      "menu.effort": "推理等级",
      "effort.providerDefault": "Default",
      "status.loading": "正在刷新模型列表…",
      "error.action": "模型操作失败：{message}",
      "error.sessionInUse": "当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。",
      "action.reload": "重新加载",
      "warning.groupLoad": "{name} 加载失败：{message}",
      "empty.models": "没有可用的模型。",
      "empty.efforts": "当前模型未提供推理等级。",
      "filter.placeholder": "筛选模型…",
      "filter.aria": "筛选模型",
      "filter.clear": "清除筛选",
      "empty.noMatch": "没有匹配的模型。",
      "filter.count": "{shown}/{total}"
    };

    /** English dictionary, checked complete against the zh key set. */
    var en = {
      "provider.account": "DeepSeek Account",
      "trigger.fallback": "Select model",
      "trigger.loading": "Loading models…",
      "trigger.selectAria": "Select model",
      "trigger.aria": "Select model, current {model}",
      "trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
      "menu.aria": "Model and reasoning effort",
      "menu.model": "Model",
      "menu.effort": "Effort",
      "effort.providerDefault": "Default",
      "status.loading": "Refreshing model list…",
      "error.action": "Model operation failed: {message}",
      "error.sessionInUse": "This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.",
      "action.reload": "Reload",
      "warning.groupLoad": "{name} failed to load: {message}",
      "empty.models": "No models available.",
      "empty.efforts": "This model provides no reasoning effort levels.",
      "filter.placeholder": "Filter models…",
      "filter.aria": "Filter models",
      "filter.clear": "Clear filter",
      "empty.noMatch": "No matching models.",
      "filter.count": "{shown}/{total}"
    };

    /* ------------------------------------------------------------------ *
     * clsx (copied; the shipped component bundles the same 12 lines)
     * ------------------------------------------------------------------ */

    function r(e) {
      var t, f, n = "";
      if ("string" == typeof e || "number" == typeof e) n += e;
      else if ("object" == typeof e) {
        if (Array.isArray(e)) {
          var o = e.length;
          for (t = 0; t < o; t++) if (e[t] && (f = r(e[t]))) { if (n) n += " "; n += f; }
        } else {
          for (f in e) if (e[f]) { if (n) n += " "; n += f; }
        }
      }
      return n;
    }
    function clsx() {
      for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) {
        if ((e = arguments[f]) && (t = r(e))) { if (n) n += " "; n += t; }
      }
      return n;
    }

    /* ------------------------------------------------------------------ *
     * Stylesheet (the shipped ModelSelect.module.css, `_dshmf_`-prefixed,
     * plus the menu material, the state dot, the toast, and the filter box)
     * ------------------------------------------------------------------ */

    var css = {
      root: "_dshmf_root",
      trigger: "_dshmf_trigger",
      triggerLabel: "_dshmf_triggerLabel",
      triggerEffort: "_dshmf_triggerEffort",
      triggerIcon: "_dshmf_triggerIcon",
      chevron: "_dshmf_chevron",
      chevronOpen: "_dshmf_chevronOpen",
      menu: "_dshmf_menu",
      status: "_dshmf_status",
      empty: "_dshmf_empty",
      error: "_dshmf_error",
      warning: "_dshmf_warning",
      retry: "_dshmf_retry",
      groups: "_dshmf_groups",
      group: "_dshmf_group",
      groupTitle: "_dshmf_groupTitle",
      option: "_dshmf_option",
      selected: "_dshmf_selected",
      optionCopy: "_dshmf_optionCopy",
      modelName: "_dshmf_modelName",
      check: "_dshmf_check",
      cell: "_dshmf_cell",
      cellLabel: "_dshmf_cellLabel",
      cellValue: "_dshmf_cellValue",
      cellChevron: "_dshmf_cellChevron",
      filterWrap: "_dshmf_filterWrap",
      filter: "_dshmf_filter",
      filterIcon: "_dshmf_filterIcon",
      filterClear: "_dshmf_filterClear",
      filterCount: "_dshmf_filterCount",
      surface: "_dshmf_surface",
      compact: "_dshmf_compact",
      material: "_dshmf_material",
      backing: "_dshmf_backing",
      dot: "_dshmf_dot",
      spinner: "_dshmf_spinner",
      spinnerMotion: "_dshmf_spinnerMotion",
      spinnerTrack: "_dshmf_spinnerTrack",
      spinnerArc: "_dshmf_spinnerArc",
      toast: "_dshmf_toast",
      toastIcon: "_dshmf_toastIcon",
      toastText: "_dshmf_toastText"
    };

    var STYLES = [
      /* --- trigger (copied from the shipped seat) --- */
      "._dshmf_root{min-width:0;position:relative}",
      "._dshmf_trigger{border-radius:var(--dsw-radius-sm);min-width:0;max-width:min(360px,45cqw);height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:400;line-height:20px;display:flex}",
      "._dshmf_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
      "._dshmf_trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}",
      "._dshmf_trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
      "._dshmf_triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
      "._dshmf_triggerEffort{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-caption);flex-shrink:1000;overflow:hidden}",
      "._dshmf_triggerIcon{display:var(--dsh-composer-model-icon-display,none);flex:none}",
      "._dshmf_triggerLabel,._dshmf_triggerEffort{display:var(--dsh-composer-model-text-display,block)}",
      "._dshmf_chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}",
      "._dshmf_chevronOpen{transform:rotate(180deg)}",
      /* --- menu shell (copied) --- */
      "._dshmf_menu{z-index:1100;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:max-content;min-width:min(240px,100vw - 32px);max-width:min(420px,100vw - 32px);max-height:min(360px,100vh - 96px);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex-direction:column;padding:4px;display:flex;position:fixed;overflow:hidden}",
      "._dshmf_status,._dshmf_empty{color:var(--dsw-alias-label-tertiary);padding:8px;font-size:12px;line-height:18px}",
      "._dshmf_error,._dshmf_warning{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:3px;padding:6px 7px;font-size:11px;line-height:16px;display:flex}",
      "._dshmf_warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}",
      "._dshmf_retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-weight:600}",
      "._dshmf_groups{min-height:0;overflow-y:auto}",
      "._dshmf_group+._dshmf_group{margin-top:3px}",
      "._dshmf_groupTitle{z-index:1;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-tertiary);padding:4px 7px 2px;font-size:11px;font-weight:500;line-height:16px;position:sticky;top:0}",
      "._dshmf_option{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;min-height:34px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:5px 7px;display:flex}",
      "._dshmf_option:hover:not(:disabled),._dshmf_option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}",
      "._dshmf_selected{background:0 0}",
      "._dshmf_option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
      "._dshmf_optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}",
      "._dshmf_modelName{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:18px;overflow:hidden}",
      "._dshmf_check{color:var(--dsw-alias-label-primary);flex:0 0 14px;place-items:center;display:grid}",
      "._dshmf_check svg{width:14px;height:14px}",
      "._dshmf_cell{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;align-items:center;gap:6px;padding:0 8px;font-size:13px;line-height:20px;display:flex}",
      "._dshmf_cell:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      "._dshmf_cellLabel{white-space:nowrap;flex:none}",
      "._dshmf_cellValue{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}",
      "._dshmf_cellChevron{width:12px;height:12px;color:var(--dsw-alias-menu-icon);flex:none}",
      /* --- the filter box (this plugin's addition) --- */
      "._dshmf_filterWrap{box-sizing:border-box;display:flex;align-items:center;gap:6px;margin:2px 2px 3px;padding:5px 7px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);color:var(--dsw-alias-label-primary);flex:none}",
      "._dshmf_filterWrap:focus-within{border-color:var(--dsw-alias-state-business-primary)}",
      "._dshmf_filterIcon{display:inline-flex;flex:none;color:var(--dsw-alias-label-tertiary)}",
      "._dshmf_filter{flex:1;min-width:0;border:none;outline:none;background:transparent;color:inherit;font:inherit;font-size:12px;line-height:18px;padding:0}",
      "._dshmf_filter::placeholder{color:var(--dsw-alias-label-dimmed)}",
      "._dshmf_filterClear{display:inline-flex;flex:none;align-items:center;justify-content:center;padding:0;border:none;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer}",
      "._dshmf_filterClear:hover{color:var(--dsw-alias-label-secondary)}",
      "._dshmf_filterCount{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
      /* --- menu material (copied from MenuSurface.module.css) --- */
      "._dshmf_surface,._dshmf_backing{border-radius:var(--dsw-radius-lg)}",
      "._dshmf_compact{border-radius:var(--dsw-radius-md)}",
      ":where(._dshmf_surface){position:relative}",
      "._dshmf_surface{anchor-name:var(--dsh-menu-anchor);isolation:isolate}",
      "._dshmf_material{position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--dsw-menu-surface-fill);backdrop-filter:var(--dsw-menu-backdrop-filter);pointer-events:none}",
      "._dshmf_backing{display:none}",
      "html[data-platform='darwin'] ._dshmf_backing{display:block;position:fixed;position-anchor:var(--dsh-menu-anchor);top:anchor(top);left:anchor(left);width:anchor-size(width,0px);height:anchor-size(height,0px);z-index:-1;background:var(--dsw-alias-bg-base);pointer-events:none}",
      /* --- state dot (copied from StateDot.module.css) --- */
      "._dshmf_dot{position:relative;display:inline-block;flex:none}",
      "._dshmf_dot::after{content:'';position:absolute;inset:20%;border-radius:50%;corner-shape:round;background:currentColor}",
      "._dshmf_spinner{flex:none;color:var(--dsw-alias-label-tertiary)}",
      "._dshmf_spinnerMotion{transform-origin:center;animation:dsh-mf-spin 1.5s linear infinite}",
      "._dshmf_spinnerTrack,._dshmf_spinnerArc{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}",
      "._dshmf_spinnerTrack{opacity:.25}",
      "._dshmf_spinnerArc{stroke-dasharray:12 150;animation:dsh-mf-dash 1.5s ease-in-out infinite}",
      "@keyframes dsh-mf-spin{to{transform:rotate(360deg)}}",
      "@keyframes dsh-mf-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}100%{stroke-dasharray:12 150;stroke-dashoffset:0}}",
      "@media (prefers-reduced-motion: reduce){._dshmf_spinnerMotion,._dshmf_spinnerArc{animation:none}._dshmf_spinnerArc{stroke-dasharray:18 150;stroke-dashoffset:-3}}",
      /* --- toast (copied from Toast.module.css) --- */
      "._dshmf_toast{position:fixed;top:40px;left:50%;z-index:1100;pointer-events:none;display:flex;align-items:center;gap:10px;width:max-content;max-width:min(640px,calc(100vw - 48px));padding:12px 16px;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-toast-bg);color:var(--dsw-alias-toast-label);font-size:14px;line-height:22px;box-shadow:var(--dsw-shadow-lv3);transform:translateX(-50%);animation:dsh-mf-toast-in 160ms ease-out,dsh-mf-toast-fade 1000ms ease var(--dsh-toast-hold,3000ms) forwards}",
      "._dshmf_toastIcon{display:grid;place-items:center;flex:none;color:var(--dsw-alias-state-warn-label)}",
      "._dshmf_toastText{min-width:0}",
      "@keyframes dsh-mf-toast-in{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translate(-50%,0)}}",
      "@keyframes dsh-mf-toast-fade{to{opacity:0;visibility:hidden}}",
      "@media (prefers-reduced-motion: reduce){._dshmf_toast{animation:dsh-mf-toast-fade 1000ms ease var(--dsh-toast-hold,3000ms) forwards}}"
    ].join("\n");

    /* ------------------------------------------------------------------ *
     * Icon artwork (copied from @deepseek-ai/dsh-client-ui-primitives;
     * that package must not be imported as a module)
     * ------------------------------------------------------------------ */

    function svg(props, children) {
      return h(
        "svg",
        {
          width: props.size,
          height: props.size,
          className: props.className,
          viewBox: "0 0 16 16",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          "aria-hidden": "true",
          strokeWidth: props.strokeWidth
        },
        children
      );
    }

    function IconDataOutlineRegular(props) {
      return svg(
        { size: props.size === undefined ? 16 : props.size, className: props.className, strokeWidth: 1 },
        [
          h("path", {
            key: "a",
            d: "M7.8667 0.349609C8.96906 0.349634 10.0601 0.481272 11.0317 0.735352C11.9973 0.987845 12.8453 1.362 13.4644 1.84766C14.0744 2.32629 14.507 2.95539 14.5161 3.69336H14.5171V8.53516C14.0843 8.32076 13.6108 8.17679 13.1108 8.11816C13.1831 7.96848 13.2162 7.82856 13.2163 7.70312V5.76758C12.6269 6.16618 11.8739 6.47995 11.0317 6.7002C10.0602 6.95423 8.96896 7.08494 7.8667 7.08496C6.76461 7.08493 5.67411 6.95415 4.70264 6.7002C3.85994 6.48006 3.10694 6.1662 2.51709 5.76758V7.70312L2.521 7.78418C2.56374 8.19554 2.93361 8.74414 3.91357 9.23145C4.9281 9.73585 6.35004 10.0371 7.8667 10.0371C8.26373 10.0371 8.6543 10.0141 9.03271 9.97461C8.75596 10.3799 8.54664 10.8349 8.42041 11.3232C8.23666 11.3313 8.0518 11.3369 7.8667 11.3369C6.20108 11.3369 4.57025 11.01 3.33447 10.3955C3.04163 10.2499 2.76658 10.0836 2.51709 9.90039V11.6738C2.51728 12.1379 2.88589 12.7556 3.92236 13.292C4.93457 13.8157 6.35342 14.1289 7.8667 14.1289C8.12318 14.1289 8.37694 14.1161 8.62646 14.0986C8.82021 14.5535 9.08999 14.9682 9.41943 15.3271C8.91285 15.3934 8.39149 15.4287 7.8667 15.4287C6.19761 15.4287 4.56379 15.0869 3.32568 14.4463C2.11244 13.8185 1.21649 12.8562 1.21631 11.6738V3.76367C1.21595 3.74853 1.21438 3.733 1.21436 3.71777C1.21436 2.96917 1.65103 2.33053 2.26807 1.84668C2.88747 1.36112 3.73675 0.987685 4.70264 0.735352C5.67413 0.481376 6.76457 0.349636 7.8667 0.349609ZM7.8667 1.65039C6.86269 1.65042 5.88326 1.77028 5.03076 1.99316C4.17183 2.2176 3.50421 2.52956 3.06982 2.87012C2.65043 3.19909 2.52622 3.48898 2.51709 3.69336V3.74414C2.52719 3.94845 2.65185 4.23772 3.06982 4.56543C3.50425 4.90601 4.17172 5.21795 5.03076 5.44238C5.88326 5.66527 6.8627 5.78513 7.8667 5.78516C8.8707 5.78513 9.85015 5.66525 10.7026 5.44238C11.5611 5.21787 12.2286 4.9049 12.6626 4.56445C13.0982 4.22252 13.2163 3.9231 13.2163 3.71777L13.2104 3.63574C13.1818 3.43623 13.044 3.16941 12.6626 2.87012C12.2286 2.52957 11.5614 2.21773 10.7026 1.99316C9.85009 1.77025 8.8708 1.65041 7.8667 1.65039Z",
            fill: "currentColor"
          }),
          h("path", {
            key: "b",
            d: "M12.8936 10.0361L13.2061 10.5566C13.2296 10.5959 13.2651 10.6562 13.3027 10.707C13.3469 10.7666 13.4148 10.8431 13.5195 10.9023C13.6244 10.9617 13.725 10.9801 13.7988 10.9873C13.8619 10.9934 13.9318 10.9932 13.9775 10.9932H14.6162L14.8896 11.4502L14.5947 11.9443C14.5698 11.9859 14.5312 12.0483 14.5029 12.1084C14.4781 12.1611 14.4514 12.2312 14.4395 12.3164L14.4326 12.4072L14.4395 12.4971C14.4514 12.5825 14.4781 12.6532 14.5029 12.7061C14.5312 12.7661 14.5689 12.8287 14.5938 12.8701L14.8896 13.3633L14.6162 13.8213H13.9775C13.9318 13.8213 13.8619 13.821 13.7988 13.8271C13.7433 13.8326 13.6728 13.8442 13.5967 13.875L13.5195 13.9121C13.4148 13.9714 13.3469 14.0478 13.3027 14.1074C13.265 14.1583 13.2296 14.2186 13.2061 14.2578L12.8936 14.7783H12.3115L11.999 14.2578C11.9755 14.2186 11.9401 14.1583 11.9023 14.1074C11.8693 14.0628 11.823 14.0083 11.7578 13.959L11.6855 13.9121L11.6074 13.875C11.5316 13.8445 11.4615 13.8325 11.4062 13.8271C11.3432 13.821 11.2733 13.8213 11.2275 13.8213H10.5889L10.3135 13.3633L10.6104 12.8701C10.6352 12.8287 10.6739 12.7661 10.7021 12.7061C10.7352 12.6357 10.7724 12.534 10.7725 12.4072C10.7724 12.2804 10.7352 12.1788 10.7021 12.1084C10.6739 12.0483 10.6353 11.9859 10.6104 11.9443L10.3135 11.4502L10.5889 10.9932H11.2275C11.2733 10.9932 11.3432 10.9934 11.4062 10.9873C11.4801 10.9801 11.5808 10.9616 11.6855 10.9023C11.7903 10.843 11.8582 10.7666 11.9023 10.707C11.94 10.6562 11.9755 10.5959 11.999 10.5566L12.3115 10.0361H12.8936Z",
            stroke: "currentColor",
            strokeMiterlimit: "10"
          })
        ]
      );
    }

    function IconChevronDownOutlineRegular(props) {
      return svg(
        { size: props.size === undefined ? 14 : props.size, className: props.className, strokeWidth: 1 },
        h("path", { d: "M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6", stroke: "currentColor" })
      );
    }

    function IconChevronRightOutlineRegular(props) {
      return svg(
        { size: props.size === undefined ? 14 : props.size, className: props.className, strokeWidth: 1 },
        h("path", { d: "M6 12L9.29289 8.70711C9.68342 8.31658 9.68342 7.68342 9.29289 7.29289L6 4", stroke: "currentColor" })
      );
    }

    function IconCheckOutlineRegular(props) {
      return svg(
        { size: props.size === undefined ? 16 : props.size, className: props.className, strokeWidth: 1 },
        h("path", { d: "M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4", stroke: "currentColor" })
      );
    }

    function IconWarningOutlineRegular(props) {
      return svg(
        { size: props.size === undefined ? 16 : props.size, className: props.className, strokeWidth: 1 },
        [
          h("path", { key: "a", d: "M8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5Z", stroke: "currentColor" }),
          h("path", { key: "b", d: "M8 4.29199V9.79199", stroke: "currentColor" }),
          h("path", { key: "c", d: "M8 10.708V11.708", stroke: "currentColor" })
        ]
      );
    }

    function IconSearchOutlineRegular(props) {
      return svg(
        { size: props.size === undefined ? 16 : props.size, className: props.className, strokeWidth: 1 },
        [
          h("path", {
            key: "a",
            d: "M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z",
            stroke: "currentColor"
          }),
          h("path", { key: "b", d: "M10.2991 10.3933L14.7783 14.8725", stroke: "currentColor" })
        ]
      );
    }

    function IconCloseOutlineRegular(props) {
      return svg(
        { size: props.size === undefined ? 16 : props.size, className: props.className, strokeWidth: 1 },
        [
          h("path", { key: "a", d: "M2.5 2.5L13.5 13.5", stroke: "currentColor" }),
          h("path", { key: "b", d: "M13.5 2.5L2.5 13.5", stroke: "currentColor" })
        ]
      );
    }

    /* ------------------------------------------------------------------ *
     * Copied primitives: MenuSurface, StateDot, Toast
     * ------------------------------------------------------------------ */

    /**
     * Menu material plus the macOS backing, copied from the primitives package
     * so this plugin imports no Harness Client module.
     */
    var MenuSurface = React.forwardRef(function MenuSurface(props, ref) {
      var compact = props.compact === true;
      var id = React.useId();
      var backingRef = React.useRef(null);
      React.useLayoutEffect(function () {
        if (backingRef.current !== null) document.body.appendChild(backingRef.current);
      }, []);
      var anchorStyle = { "--dsh-menu-anchor": "--dsh-menu-" + id.replace(/:/g, "") };
      var rest = {};
      for (var k in props) {
        if (k !== "compact" && k !== "className" && k !== "style" && k !== "children") rest[k] = props[k];
      }
      var surfaceStyle = {};
      for (var s in props.style || {}) surfaceStyle[s] = props.style[s];
      for (var a in anchorStyle) surfaceStyle[a] = anchorStyle[a];
      return h(Fragment, null, [
        h(
          "div",
          Object.assign({}, rest, {
            key: "surface",
            ref: ref,
            "data-menu-material": "translucent",
            className: clsx(css.surface, compact && css.compact, props.className),
            style: surfaceStyle
          }),
          [
            h("div", { key: "material", "aria-hidden": "true", className: css.material }),
            props.children
          ]
        ),
        ReactDOM.createPortal(
          h("div", {
            ref: backingRef,
            "aria-hidden": "true",
            "data-menu-backing": "",
            className: clsx(css.backing, compact && css.compact),
            style: Object.assign({}, anchorStyle, {
              visibility: props.style === undefined ? undefined : props.style.visibility
            })
          }),
          document.body
        )
      ]);
    });

    /** Activity dot / spinner, copied from the primitives package. */
    function StateDot(props) {
      var state = props.state;
      var edge = props.size === undefined ? (state === "ongoing" ? 14 : 10) : props.size;
      if (state === "ongoing") {
        return h(
          "svg",
          {
            className: clsx(css.spinner, props.className),
            "data-state": "ongoing",
            width: edge,
            height: edge,
            viewBox: "0 0 24 24",
            "aria-hidden": "true"
          },
          h("g", { className: css.spinnerMotion }, [
            h("circle", { key: "t", className: css.spinnerTrack, cx: "12", cy: "12", r: "9.5" }),
            h("circle", { key: "a", className: css.spinnerArc, cx: "12", cy: "12", r: "9.5" })
          ])
        );
      }
      return h("span", {
        className: clsx(css.dot, props.className),
        "data-state": state,
        style: { width: edge, height: edge },
        "aria-hidden": "true"
      });
    }

    /** Fade-out banner, copied from the primitives package. */
    var HOLD_MS = 3000;
    var FADE_MS = 1000;

    function Toast(props) {
      var holdMs = props.holdMs === undefined ? HOLD_MS : props.holdMs;
      var latestOnDone = React.useRef(props.onDone);
      React.useLayoutEffect(function () {
        latestOnDone.current = props.onDone;
      }, [props.onDone]);
      React.useEffect(
        function () {
          var timer = setTimeout(function () {
            latestOnDone.current();
          }, holdMs + FADE_MS);
          return function () {
            clearTimeout(timer);
          };
        },
        [holdMs]
      );
      var leftState = React.useState(null);
      var left = leftState[0];
      var setLeft = leftState[1];
      React.useLayoutEffect(
        function () {
          if (props.anchor === null || props.anchor === undefined) return;
          var anchor = props.anchor;
          var measure = function () {
            var rect = anchor.getBoundingClientRect();
            setLeft(rect.left + rect.width / 2);
          };
          measure();
          window.addEventListener("resize", measure);
          return function () {
            window.removeEventListener("resize", measure);
          };
        },
        [props.anchor]
      );
      var style = { "--dsh-toast-hold": holdMs + "ms" };
      if (left !== null) style.left = left;
      return ReactDOM.createPortal(
        h("div", { className: css.toast, role: "alert", style: style }, [
          props.icon === undefined
            ? null
            : h("span", { key: "icon", className: css.toastIcon, "aria-hidden": "true" }, props.icon),
          h("span", { key: "text", className: css.toastText }, props.text)
        ]),
        document.body
      );
    }

    /* ------------------------------------------------------------------ *
     * The filtered model seat
     * ------------------------------------------------------------------ */

    /** Unplaced portal card: hidden but laid out so offsetWidth/offsetHeight are real. */
    var MEASURE_STYLE = { visibility: "hidden", left: 0, top: 0 };

    /** Provider sort rank: the two built-in DeepSeek routes first, then catalog order. */
    function providerRank(id) {
      return id === "deepseek-account" ? 0 : id === "deepseek-official" ? 1 : 2;
    }

    /**
     * Render the composer model seat with a filter box over the model list.
     * @param props - owner share (locked), injected face (shared directory
     * store/verbs), and the locale seat.
     * @returns the trigger and, while open, the two-level menu.
     */
    function ModelSelectFiltered(props) {
      var locked = props.locked;
      var available = props.available;
      var directory = props.directory;
      var load = props.load;
      var select = props.select;
      var t = props.t;

      var state = React.useSyncExternalStore(
        function (fn) {
          return directory.subscribe(fn);
        },
        function () {
          return directory.getSnapshot();
        }
      );
      var openState = React.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var paneState = React.useState("root");
      var pane = paneState[0];
      var setPane = paneState[1];
      var filterState = React.useState("");
      var filter = filterState[0];
      var setFilter = filterState[1];
      var lastActionRef = React.useRef("load");
      var toastState = React.useState(null);
      var toast = toastState[0];
      var setToast = toastState[1];
      var toastSeq = React.useRef(0);
      var rootRef = React.useRef(null);
      var triggerRef = React.useRef(null);
      var menuRef = React.useRef(null);
      var filterRef = React.useRef(null);
      var menuPosState = React.useState(null);
      var menuPos = menuPosState[0];
      var setMenuPos = menuPosState[1];
      var itemRefs = React.useRef([]);
      var id = React.useId();

      var groups = React.useMemo(
        function () {
          return state.groups.slice().sort(function (left, right) {
            return providerRank(left.id) - providerRank(right.id);
          });
        },
        [state.groups]
      );

      var choices = React.useMemo(
        function () {
          var out = [];
          for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            for (var m = 0; m < group.models.length; m++) {
              var model = group.models[m];
              var selection = { provider: group.id, model: model.id };
              if (model.reasoning !== undefined && model.reasoning !== null && model.reasoning.defaultEffort !== undefined) {
                selection.reasoningEffort = model.reasoning.defaultEffort;
              }
              out.push({ group: group, model: model, selection: selection });
            }
          }
          return out;
        },
        [groups]
      );

      var currentIndex = -1;
      if (state.current !== null) {
        for (var ci = 0; ci < choices.length; ci++) {
          if (choices[ci].selection.provider === state.current.provider && choices[ci].selection.model === state.current.model) {
            currentIndex = ci;
            break;
          }
        }
      }
      var currentChoice = currentIndex === -1 ? undefined : choices[currentIndex];
      var reasoning = currentChoice === undefined ? undefined : currentChoice.model.reasoning;
      var effectiveEffort = state.current === null || state.current.reasoningEffort === undefined
        ? (reasoning === undefined ? undefined : reasoning.defaultEffort)
        : state.current.reasoningEffort;
      var effortLabel;
      if (reasoning === undefined) effortLabel = state.retainedEffort;
      else if (effectiveEffort === undefined) effortLabel = t("effort.providerDefault");
      else {
        var matched = null;
        for (var ei = 0; ei < reasoning.efforts.length; ei++) {
          if (reasoning.efforts[ei].id === effectiveEffort) { matched = reasoning.efforts[ei]; break; }
        }
        effortLabel = matched === null ? effectiveEffort : matched.name;
      }

      var effortChoices = React.useMemo(
        function () {
          if (reasoning === undefined) return [];
          var out = [];
          if (reasoning.defaultEffort === undefined) {
            out.push({ key: "provider-default", effort: undefined, label: t("effort.providerDefault") });
          }
          for (var i = 0; i < reasoning.efforts.length; i++) {
            out.push({ key: "effort:" + reasoning.efforts[i].id, effort: reasoning.efforts[i].id, label: reasoning.efforts[i].name });
          }
          return out;
        },
        [reasoning, t]
      );

      var pending = state.pending;
      var busy = pending !== null;

      /* --- the filter (this plugin's addition) ------------------------- */

      var query = filter.trim().toLowerCase();

      /** Whether one model survives the filter: name, id, description, or its provider. */
      var matches = React.useCallback(
        function (model, groupName) {
          if (query === "") return true;
          if (model.name.toLowerCase().indexOf(query) !== -1) return true;
          if (model.id.toLowerCase().indexOf(query) !== -1) return true;
          if (groupName.toLowerCase().indexOf(query) !== -1) return true;
          if (typeof model.description === "string" && model.description.toLowerCase().indexOf(query) !== -1) return true;
          return false;
        },
        [query]
      );

      var visibleGroups = React.useMemo(
        function () {
          var out = [];
          for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            var groupName = group.id === "deepseek-account" ? t("provider.account") : group.name;
            var kept = [];
            for (var m = 0; m < group.models.length; m++) {
              if (matches(group.models[m], groupName)) kept.push(group.models[m]);
            }
            if (kept.length > 0) out.push({ group: group, groupName: groupName, models: kept });
          }
          return out;
        },
        [groups, matches, t]
      );

      var shownCount = 0;
      for (var vg = 0; vg < visibleGroups.length; vg++) shownCount += visibleGroups[vg].models.length;

      var reload = function () {
        lastActionRef.current = "load";
        load();
      };

      React.useEffect(
        function () {
          if (!open) return undefined;
          var closeOutside = function (event) {
            if (rootRef.current !== null && rootRef.current.contains(event.target)) return;
            if (menuRef.current !== null && menuRef.current.contains(event.target)) return;
            setOpen(false);
          };
          document.addEventListener("mousedown", closeOutside);
          return function () {
            document.removeEventListener("mousedown", closeOutside);
          };
        },
        [open]
      );

      var paneFocus = React.useRef(null);
      React.useEffect(
        function () {
          var intent = paneFocus.current;
          paneFocus.current = null;
          if (!open || intent === null) return;
          if (intent === "drill") {
            // A filterable list wants the caret on arrival: typing narrows, and
            // ArrowDown still steps into the rows from here.
            if (pane === "model" && filterRef.current !== null) {
              filterRef.current.focus();
              return;
            }
            var checked = menuRef.current === null ? null : menuRef.current.querySelector('[role="menuitemradio"][aria-checked="true"]:not([disabled])');
            var fallback = null;
            for (var i = 0; i < itemRefs.current.length; i++) {
              var item = itemRefs.current[i];
              if (item !== null && !item.disabled) { fallback = item; break; }
            }
            var target = checked !== null ? checked : fallback !== null ? fallback : triggerRef.current;
            if (target !== null && target !== undefined) target.focus();
            return;
          }
          var cell = itemRefs.current[intent === "effort" ? 1 : 0];
          var to = cell !== null && cell !== undefined && !cell.disabled ? cell : triggerRef.current;
          if (to !== null && to !== undefined) to.focus();
        },
        [open, pane]
      );

      React.useLayoutEffect(
        function () {
          if (!open) {
            setMenuPos(null);
            return undefined;
          }
          var place = function () {
            if (triggerRef.current === null) return;
            var rect = triggerRef.current.getBoundingClientRect();
            var MARGIN = 12;
            var lw = menuRef.current === null ? 0 : menuRef.current.offsetWidth;
            var lh = menuRef.current === null ? 0 : menuRef.current.offsetHeight;
            var x = rect.right - lw;
            var y = rect.top - 8 - lh;
            if (lw > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - lw - MARGIN);
            if (lh > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - lh - MARGIN);
            setMenuPos({ left: x, top: y });
          };
          place();
          window.addEventListener("scroll", place, true);
          window.addEventListener("resize", place);
          return function () {
            window.removeEventListener("scroll", place, true);
            window.removeEventListener("resize", place);
          };
        },
        [open, pane, state, filter]
      );

      if (!available) return null;

      var show = function () {
        if (triggerRef.current !== null) triggerRef.current.focus();
        if (state.current === null) paneFocus.current = "drill";
        setPane(state.current === null ? "model" : "root");
        setFilter("");
        setOpen(true);
        reload();
      };
      var close = function (restoreFocus) {
        setOpen(false);
        setPane("root");
        setFilter("");
        if (restoreFocus === true) {
          queueMicrotask(function () {
            if (triggerRef.current !== null) triggerRef.current.focus();
          });
        }
      };
      var drill = function (next) {
        paneFocus.current = "drill";
        if (next !== "model") setFilter("");
        setPane(next);
      };
      var back = function (from) {
        paneFocus.current = from;
        setFilter("");
        setPane("root");
      };
      var moveFocus = function (offset) {
        var items = [];
        for (var i = 0; i < itemRefs.current.length; i++) {
          if (itemRefs.current[i] !== null) items.push(itemRefs.current[i]);
        }
        if (items.length === 0) return;
        var active = items.indexOf(document.activeElement);
        var at = active === -1 ? (offset > 0 ? 0 : items.length - 1) : (active + offset + items.length) % items.length;
        if (items[at] !== undefined) items[at].focus();
      };

      var onRootKeyDown = function (event) {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          if (pane !== "root" && state.current !== null) back(pane);
          else close(true);
          return;
        }
        if (!open) return;
        if (event.key === "Tab") {
          if (event.shiftKey) {
            event.preventDefault();
            if (pane !== "root" && state.current !== null) back(pane);
            else close(true);
            return;
          }
          var focusedTab = document.activeElement;
          var rows = [];
          for (var i = 0; i < itemRefs.current.length; i++) {
            if (itemRefs.current[i] !== null) rows.push(itemRefs.current[i]);
          }
          if (focusedTab instanceof HTMLButtonElement && rows.indexOf(focusedTab) !== -1) {
            event.preventDefault();
            focusedTab.click();
            return;
          }
          if (focusedTab !== triggerRef.current) return;
          event.preventDefault();
          var checked = menuRef.current === null ? null : menuRef.current.querySelector('[role="menuitemradio"][aria-checked="true"]:not([disabled])');
          var first = null;
          for (var j = 0; j < rows.length; j++) {
            if (!rows[j].disabled) { first = rows[j]; break; }
          }
          var to = checked !== null ? checked : first;
          if (to !== null && to !== undefined) to.focus();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(event.key === "ArrowDown" ? 1 : -1);
        }
      };

      var onBlur = function (event) {
        if (event.relatedTarget instanceof Node) {
          if (rootRef.current !== null && rootRef.current.contains(event.relatedTarget)) return;
          if (menuRef.current !== null && menuRef.current.contains(event.relatedTarget)) return;
        }
        close(false);
      };

      var settleSelection = function (result) {
        if (result === undefined) return;
        if (result.ok) {
          if (rootRef.current !== null) close(true);
          return;
        }
        var error = result.error;
        toastSeq.current += 1;
        setToast({
          seq: toastSeq.current,
          text: error.code === "session/writer-held"
            ? t("error.sessionInUse")
            : t("error.action", { message: error.code + ": " + error.message })
        });
      };

      var submit = function (selection) {
        lastActionRef.current = "select";
        if (triggerRef.current !== null) triggerRef.current.focus();
        select(selection).then(settleSelection);
      };

      var choose = function (selection) {
        if (state.current !== null && state.current.provider === selection.provider && state.current.model === selection.model) {
          close(true);
          return;
        }
        submit(selection);
      };

      var chooseEffort = function (effort) {
        if (state.current === null) return;
        if (effectiveEffort === effort) {
          close(true);
          return;
        }
        var selection = { provider: state.current.provider, model: state.current.model };
        if (effort !== undefined) selection.reasoningEffort = effort;
        submit(selection);
      };

      var waiting = state.current === null && state.status === "loading";
      var modelLabel;
      if (waiting) modelLabel = t("trigger.loading");
      else if (currentChoice !== undefined) modelLabel = currentChoice.model.name;
      else if (state.current === null) modelLabel = t("trigger.fallback");
      else modelLabel = state.current.provider + "/" + state.current.model;

      var triggerLabel = effortLabel === undefined ? modelLabel : modelLabel + " · " + effortLabel;
      var triggerAria;
      if (waiting) triggerAria = t("trigger.loading");
      else if (state.current === null) triggerAria = t("trigger.selectAria");
      else if (effortLabel === undefined) triggerAria = t("trigger.aria", { model: modelLabel });
      else triggerAria = t("trigger.ariaEffort", { model: modelLabel, effort: effortLabel });

      itemRefs.current = [];
      var itemIndex = 0;
      var itemRef = function () {
        var at = itemIndex++;
        return function (node) {
          itemRefs.current[at] = node;
        };
      };

      /* --- the model pane rows ---------------------------------------- */

      var modelPane = null;
      if (pane === "model") {
        var blocks = [];

        if (state.status === "loading") {
          blocks.push(h("div", { key: "status", className: css.status }, t("status.loading")));
        }

        if (state.error !== null && lastActionRef.current === "load") {
          blocks.push(
            h("div", { key: "error", className: css.error }, [
              h("span", { key: "msg" }, t("error.action", { message: state.error })),
              h("button", { key: "retry", type: "button", className: css.retry, onClick: reload }, t("action.reload"))
            ])
          );
        }

        for (var fi = 0; fi < state.failures.length; fi++) {
          var failure = state.failures[fi];
          blocks.push(
            h("div", { key: "fail-" + failure.id, className: css.warning }, [
              h(
                "span",
                { key: "msg" },
                t("warning.groupLoad", {
                  name: failure.id === "deepseek-account" ? t("provider.account") : failure.name,
                  message: failure.message
                })
              ),
              h("button", { key: "retry", type: "button", className: css.retry, onClick: reload }, t("action.reload"))
            ])
          );
        }

        // The filter box. It is deliberately NOT registered in itemRefs: the
        // arrow-key walk then steps from the input straight into the rows.
        blocks.push(
          h(
            "div",
            { key: "filter", className: css.filterWrap, "data-dsh-model-filter": "" },
            [
              h("span", { key: "icon", className: css.filterIcon, "aria-hidden": "true" }, h(IconSearchOutlineRegular, { size: 14 })),
              h("input", {
                key: "input",
                ref: filterRef,
                className: css.filter,
                type: "text",
                value: filter,
                placeholder: t("filter.placeholder"),
                "aria-label": t("filter.aria"),
                autoComplete: "off",
                spellCheck: false,
                onChange: function (event) {
                  setFilter(event.currentTarget.value);
                },
                onKeyDown: function (event) {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    for (var i = 0; i < visibleGroups.length; i++) {
                      var g = visibleGroups[i].group;
                      var model = visibleGroups[i].models[0];
                      choose({ provider: g.id, model: model.id });
                      return;
                    }
                  }
                }
              }),
              query === ""
                ? null
                : h("span", { key: "count", className: css.filterCount }, t("filter.count", { shown: shownCount, total: choices.length })),
              query === ""
                ? null
                : h(
                    "button",
                    {
                      key: "clear",
                      type: "button",
                      className: css.filterClear,
                      title: t("filter.clear"),
                      "aria-label": t("filter.clear"),
                      onClick: function () {
                        setFilter("");
                        if (filterRef.current !== null) filterRef.current.focus();
                      }
                    },
                    h(IconCloseOutlineRegular, { size: 12 })
                  )
            ]
          )
        );

        var groupNodes = [];
        for (var gi = 0; gi < visibleGroups.length; gi++) {
          var entry = visibleGroups[gi];
          var headingId = id + "-" + entry.group.id;
          var optionNodes = [];
          for (var mi = 0; mi < entry.models.length; mi++) {
            var m = entry.models[mi];
            var selected = state.current !== null && state.current.provider === entry.group.id && state.current.model === m.id;
            var isPending = pending !== null && pending.provider === entry.group.id && pending.model === m.id;
            optionNodes.push(
              h(
                "button",
                {
                  key: m.id,
                  ref: itemRef(),
                  type: "button",
                  role: "menuitemradio",
                  "aria-checked": selected,
                  className: clsx(css.option, selected && css.selected),
                  title: m.name,
                  disabled: busy,
                  onClick: function (group, model) {
                    return function () {
                      choose({ provider: group.id, model: model.id });
                    };
                  }(entry.group, m)
                },
                [
                  h("span", { key: "copy", className: css.optionCopy }, h("span", { className: css.modelName }, m.name)),
                  h(
                    "span",
                    { key: "check", className: css.check },
                    isPending ? h(StateDot, { state: "ongoing" }) : selected ? h(IconCheckOutlineRegular, {}) : null
                  )
                ]
              )
            );
          }
          groupNodes.push(
            h(
              "section",
              { key: entry.group.id, role: "group", "aria-labelledby": headingId, className: css.group },
              [
                h("div", { key: "title", className: css.groupTitle, id: headingId }, entry.groupName),
                optionNodes
              ]
            )
          );
        }

        blocks.push(h("div", { key: "groups", className: clsx(css.groups, "scrollable") }, groupNodes));

        if (query !== "" && shownCount === 0 && state.status !== "loading") {
          blocks.push(h("div", { key: "nomatch", className: css.empty }, t("empty.noMatch")));
        } else if (state.status === "ready" && choices.length === 0) {
          blocks.push(h("div", { key: "empty", className: css.empty }, t("empty.models")));
        }

        modelPane = h(Fragment, null, blocks);
      }

      /* --- the effort pane rows --------------------------------------- */

      var effortPane = null;
      if (pane === "effort") {
        var eblocks = [];
        if (state.error !== null && lastActionRef.current === "load") {
          eblocks.push(
            h("div", { key: "error", className: css.error }, [
              h("span", { key: "msg" }, t("error.action", { message: state.error })),
              h("button", { key: "retry", type: "button", className: css.retry, onClick: reload }, t("action.reload"))
            ])
          );
        }
        if (effortChoices.length === 0) {
          eblocks.push(h("div", { key: "empty", className: css.empty }, t("empty.efforts")));
        } else {
          for (var li = 0; li < effortChoices.length; li++) {
            var level = effortChoices[li];
            var levelSelected = effectiveEffort === level.effort;
            var levelPending = pending !== null && state.current !== null &&
              pending.provider === state.current.provider && pending.model === state.current.model &&
              pending.reasoningEffort === level.effort;
            eblocks.push(
              h(
                "button",
                {
                  key: level.key,
                  ref: itemRef(),
                  type: "button",
                  role: "menuitemradio",
                  "aria-checked": levelSelected,
                  className: clsx(css.option, levelSelected && css.selected),
                  disabled: busy,
                  onClick: function (effort) {
                    return function () {
                      chooseEffort(effort);
                    };
                  }(level.effort)
                },
                [
                  h("span", { key: "copy", className: css.optionCopy }, h("span", { className: css.modelName }, level.label)),
                  h(
                    "span",
                    { key: "check", className: css.check },
                    levelPending ? h(StateDot, { state: "ongoing" }) : levelSelected ? h(IconCheckOutlineRegular, {}) : null
                  )
                ]
              )
            );
          }
        }
        effortPane = h(Fragment, null, eblocks);
      }

      /* --- root pane --------------------------------------------------- */

      var rootPane = null;
      if (pane === "root") {
        rootPane = h(Fragment, null, [
          h(
            "button",
            {
              key: "model",
              ref: itemRef(),
              type: "button",
              role: "menuitem",
              className: css.cell,
              onClick: function () {
                drill("model");
              }
            },
            [
              h("span", { key: "l", className: css.cellLabel }, t("menu.model")),
              h("span", { key: "v", className: css.cellValue }, modelLabel),
              h(IconChevronRightOutlineRegular, { key: "c", className: css.cellChevron })
            ]
          ),
          reasoning === undefined
            ? null
            : h(
                "button",
                {
                  key: "effort",
                  ref: itemRef(),
                  type: "button",
                  role: "menuitem",
                  className: css.cell,
                  onClick: function () {
                    drill("effort");
                  }
                },
                [
                  h("span", { key: "l", className: css.cellLabel }, t("menu.effort")),
                  h("span", { key: "v", className: css.cellValue }, effortLabel),
                  h(IconChevronRightOutlineRegular, { key: "c", className: css.cellChevron })
                ]
              )
        ]);
      }

      var menu =
        !open
          ? null
          : ReactDOM.createPortal(
              h(
                MenuSurface,
                {
                  ref: menuRef,
                  id: id + "-menu",
                  className: css.menu,
                  style: menuPos === null ? MEASURE_STYLE : menuPos,
                  role: "menu",
                  "aria-label": t("menu.aria"),
                  "aria-busy": state.status === "loading" || busy
                },
                [rootPane, modelPane, effortPane]
              ),
              document.body
            );

      return h(
        "div",
        {
          ref: rootRef,
          className: css.root,
          onKeyDown: onRootKeyDown,
          onBlur: onBlur,
          onMouseDown: function (event) {
            if (event.target instanceof Element && event.target.closest("button") !== null) event.preventDefault();
          }
        },
        [
          h(
            "button",
            {
              key: "trigger",
              ref: triggerRef,
              type: "button",
              className: css.trigger,
              "aria-label": triggerAria,
              "aria-haspopup": "menu",
              "aria-expanded": open,
              "aria-controls": open ? id + "-menu" : undefined,
              title: triggerLabel,
              "aria-busy": busy,
              disabled: locked,
              onClick: function () {
                if (open) close(true);
                else show();
              }
            },
            [
              h(IconDataOutlineRegular, { key: "i", className: css.triggerIcon, size: 16 }),
              h("span", { key: "l", className: css.triggerLabel }, modelLabel),
              effortLabel === undefined ? null : h("span", { key: "e", className: css.triggerEffort }, effortLabel),
              busy
                ? h(StateDot, { key: "s", state: "ongoing" })
                : h(IconChevronDownOutlineRegular, { key: "c", className: clsx(css.chevron, open && css.chevronOpen) })
            ]
          ),
          menu,
          toast === null
            ? null
            : h(
                Toast,
                {
                  key: toast.seq,
                  text: toast.text,
                  icon: h(IconWarningOutlineRegular, {}),
                  anchor: rootRef.current === null ? null : rootRef.current.closest("[data-composer-card]"),
                  onDone: function () {
                    setToast(null);
                  }
                }
              )
        ]
      );
    }

    /* ------------------------------------------------------------------ *
     * Plugin body
     * ------------------------------------------------------------------ */

    function apply(ctx) {
      ctx.effect(function () {
        var el = document.createElement("style");
        el.dataset.plugin = "dsh-plugin-model-filter";
        el.dataset.pluginCss = "dsh-plugin-model-filter/filtered-model-select";
        el.textContent = STYLES;
        document.head.appendChild(el);
        return function () {
          el.remove();
        };
      }, "model-filter: styles");

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, "model-filter: dictionaries");

      // Soft injections: this plugin contributes only when the model directory
      // service and the Session face are actually present, instead of failing
      // the whole client activation in a profile without them.
      ctx.inject(["slots", "modelDirectories", "sessions"], function (scope) {
        var models = scope.modelDirectories;
        var sessions = scope.sessions;

        scope.slots.inject("conversation.input.model", function () {
          return scope.slots.register(
            {
              name: "conversation.input.model",
              // The seat is `single` and renders its LOWEST-priority live entry:
              // -1 shadows the shipped occupant (default 0) without disposing it,
              // so disabling this bundle restores the shipped control untouched.
              priority: -1,
              locale: NS,
              inject: function (sessionId) {
                var directory = models.directoryFor(sessionId);
                var available = sessions.subagentAddress(sessionId) === undefined;
                return {
                  available: available,
                  directory: directory.store,
                  load: function () {
                    if (available) directory.load().catch(function () {});
                  },
                  select: function (selection) {
                    return available ? directory.select(selection) : Promise.resolve(undefined);
                  }
                };
              }
            },
            ModelSelectFiltered
          );
        });
      });
    }

    exports.name = "model-filter";
    // Hard requirements only. `modelDirectories` and `sessions` are taken
    // through the soft `ctx.inject` below, so this bundle still activates in a
    // profile that lacks the model-selection plugin.
    exports.inject = ["slots", "locale"];
    exports.apply = apply;

    return module.exports;
  }
});
