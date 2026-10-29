/**
 * Copy for dsh-select-quote, served through the host locale service.
 *
 * The active language is owned by `@deepseek-ai/dsh-client-locale` (Settings →
 * General → Language, persisted as `locale.preference`). This module owns only
 * the dictionaries and the plural form selection that the host's plain-template
 * lookup cannot express; it never resolves a language on its own.
 *
 * NOT localized on purpose:
 *   - wire markers (`> [选中文本]`, `<response-annotations>`,
 *     `:dsh-annotation{index="N"}`) — they are the message format the model
 *     and the transcript parser agree on;
 *   - the `# Response annotations:` header — model-facing instruction prose,
 *     not UI text.
 *
 * Dictionaries cover every language dsh can select: the two baseline locales
 * (`zh` / `en`) plus the language packs the Host ships from 0.2.2-alpha.2 on
 * (`ja` / `es` / `fr` / `de` / `ru` / `pt`). On older Hosts those packs are
 * added by this plugin through `addLanguage()`.
 */

export const LOCALE_NS = 'select-quote'

/** Dictionary keys are flat strings; `{name}` placeholders are filled by the host. */
export type LocaleDict = Record<string, string>

/**
 * Count-bearing messages carry one key per plural form instead of a base key,
 * because the host resolves a single template string per key.
 */
const PLURAL_FORMS = ['one', 'few', 'many', 'other'] as const
type PluralForm = (typeof PLURAL_FORMS)[number]

const zh: LocaleDict = {
  'common.selectedText': '选中的文本',
  'common.commentPlaceholder': '添加可选评论…',
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.save': '保存',

  'toolbar.aria': '划词操作',
  'toolbar.commentHint': '添加批注…',
  'toolbar.copy': '复制',
  'toolbar.openLink': '打开链接',
  'toolbar.copyFailed': '复制失败',
  'toolbar.addToTask': '添加到任务',
  'toolbar.commentDialogAria': '添加可选评论',
  'toolbar.skipComment': '暂不评论',
  'toolbar.addComment': '添加评论',
  'toolbar.askInSide': '在侧边提问',
  'toolbar.sideTaskFailed': '侧边提问创建失败',
  'toolbar.sideTaskUnavailable': '当前无法创建侧边提问',
  'sideTask.title': '在侧边提问',
  'sideTask.placeholder': '就这段原文提问…',
  'sideTask.send': '发送',
  'sideTask.sending': '创建中…',

  'model.follow': '跟随主会话',
  'model.releaseBadge': '1017',
  'model.triggerFallback': '请选择模型',
  'model.triggerLoading': '正在加载模型…',
  'model.triggerAria': '选择模型，当前 {model}',
  'model.triggerAriaEffort': '选择模型，当前 {model}，推理等级 {effort}',
  'model.menuAria': '模型与推理等级',
  'model.model': '模型',
  'model.effort': '推理等级',
  'model.providerDefault': 'Default',
  'model.providerAccount': 'DeepSeek 账号',
  'model.statusLoading': '正在刷新模型列表…',
  'model.errorAction': '模型操作失败：{message}',
  'model.groupLoad': '{name} 加载失败：{message}',
  'model.retry': '重新加载',
  'model.searchPlaceholder': '搜索模型…',
  'model.searchClear': '清除搜索',
  'model.searchEmpty': '没有匹配的模型。',
  'model.emptyModels': '暂无可用模型',
  'model.emptyEfforts': '当前模型未提供推理等级。',

  'menu.aria': '划词菜单',
  'menu.shortcutLabel': '打开划词菜单',
  'menu.addShortcutLabel': '将选中文字添加到任务',
  'menu.noSelection': '先在对话里选中一段文字',
  'menu.busy': '先完成当前批注',

  'summary.hint': '悬停查看批注',
  'summary.hintTouch': '点按查看批注',
  'summary.dialogAria': '{count} 条划词批注详情',
  'summary.edit': '编辑批注 {index}',
  'summary.remove': '移除批注 {index}',
  'summary.userComment': '用户评论',
  'summary.noComment': '未添加评论',
  'summary.aria.other': '{count} 条划词批注。展开查看详情。',
  'summary.title.other': '{count} 条批注',
  'summary.removeAll': '移除全部划词批注',

  'chip.annotation': '批注 {index}',
  'chip.previewAria': '批注预览',
  'mark.previewAria': '查看第 {index} 条批注',
  'chip.jump': '原文',
  'chip.jumpAria': '跳转到原文',

  'settings.trigger': '划词入口',
  'settings.triggerHint': '选中文字后何时显示操作条。触屏始终使用底部操作条。',
  'settings.trigger.auto': '自动浮出',
  'settings.trigger.contextmenu': '右键菜单',
  'settings.trigger.both': '两者都开',
  'settings.shortcut': '快捷键',
  'settings.shortcutHint': '开启后，选中文字即可使用下面的快捷键；可在宿主的「快捷键」设置里改键。',
  'settings.shortcutListAria': '当前快捷键',
  'settings.shortcutUnavailable': '快捷键暂不可用（可能被其它插件占用）',
  'settings.shortcutUnbound': '未绑定',
  'settings.shortcutConflict': '与其它快捷键冲突',
  'settings.sideTaskMode': '侧边提问的子代理',
  'settings.sideTaskModeHint':
    '每次提问新建一个子代理，或复用同一个侧边子代理。复用后子智能体目录里只保留一条，但子代理继承的上下文停在第一次创建时。',
  'settings.sideTaskMode.separate': '每次独立',
  'settings.sideTaskMode.reuse': '复用同一个',
}

const en: LocaleDict = {
  'common.selectedText': 'Selected text',
  'common.commentPlaceholder': 'Add an optional comment…',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.save': 'Save',

  'toolbar.aria': 'Selection actions',
  'toolbar.commentHint': 'Add annotation…',
  'toolbar.copy': 'Copy',
  'toolbar.openLink': 'Open link',
  'toolbar.copyFailed': 'Copy failed',
  'toolbar.addToTask': 'Add to task',
  'toolbar.commentDialogAria': 'Add an optional comment',
  'toolbar.skipComment': 'Skip comment',
  'toolbar.addComment': 'Add comment',
  'toolbar.askInSide': 'Ask in side task',
  'toolbar.sideTaskFailed': 'Could not start the side task',
  'toolbar.sideTaskUnavailable': 'The side task is unavailable here',
  'sideTask.title': 'Ask in side task',
  'sideTask.placeholder': 'Ask about this passage…',
  'sideTask.send': 'Send',
  'sideTask.sending': 'Starting…',

  'model.follow': 'Follow main conversation',
  'model.releaseBadge': '1017',
  'model.triggerFallback': 'Select model',
  'model.triggerLoading': 'Loading models…',
  'model.triggerAria': 'Select model, current {model}',
  'model.triggerAriaEffort': 'Select model, current {model}, reasoning effort {effort}',
  'model.menuAria': 'Model and reasoning effort',
  'model.model': 'Model',
  'model.effort': 'Effort',
  'model.providerDefault': 'Default',
  'model.providerAccount': 'DeepSeek Account',
  'model.statusLoading': 'Refreshing model list…',
  'model.errorAction': 'Model operation failed: {message}',
  'model.groupLoad': '{name} failed to load: {message}',
  'model.retry': 'Reload',
  'model.searchPlaceholder': 'Search models…',
  'model.searchClear': 'Clear search',
  'model.searchEmpty': 'No matching models.',
  'model.emptyModels': 'No models available.',
  'model.emptyEfforts': 'This model provides no reasoning effort levels.',

  'menu.aria': 'Selection menu',
  'menu.shortcutLabel': 'Open selection menu',
  'menu.addShortcutLabel': 'Add selected text to task',
  'menu.noSelection': 'Select text in the conversation first',
  'menu.busy': 'Finish the current annotation first',

  'summary.hint': 'Hover to view annotations',
  'summary.hintTouch': 'Tap to view annotations',
  'summary.dialogAria': 'Annotation details: {count}',
  'summary.edit': 'Edit annotation {index}',
  'summary.remove': 'Remove annotation {index}',
  'summary.userComment': 'User comment',
  'summary.noComment': 'No comment added',
  'summary.aria.one': '{count} annotation. Open to view details.',
  'summary.aria.other': '{count} annotations. Open to view details.',
  'summary.title.one': '{count} annotation',
  'summary.title.other': '{count} annotations',
  'summary.removeAll': 'Remove all annotations',

  'chip.annotation': 'Annotation {index}',
  'chip.previewAria': 'Annotation preview',
  'mark.previewAria': 'View annotation {index}',
  'chip.jump': 'Original',
  'chip.jumpAria': 'Jump to original',

  'settings.trigger': 'Trigger',
  'settings.triggerHint': 'When the action bar appears after you select text. Touch screens always use the bottom bar.',
  'settings.trigger.auto': 'Automatic',
  'settings.trigger.contextmenu': 'Right-click',
  'settings.trigger.both': 'Both',
  'settings.shortcut': 'Shortcut',
  'settings.shortcutHint': 'When on, the shortcuts below work on the selected text. Rebind them in the Host\'s Keyboard shortcuts settings.',
  'settings.shortcutListAria': 'Active shortcuts',
  'settings.shortcutUnavailable': 'Shortcuts are unavailable (another plugin may already use the keys).',
  'settings.shortcutUnbound': 'Unbound',
  'settings.shortcutConflict': 'Conflicts with another shortcut',
  'settings.sideTaskMode': 'Side-task subagent',
  'settings.sideTaskModeHint':
    'Create a subagent for every question, or keep one side subagent. Reusing leaves a single catalog entry, but the inherited context stops at its first creation.',
  'settings.sideTaskMode.separate': 'New each time',
  'settings.sideTaskMode.reuse': 'Reuse one',
}

const ja: LocaleDict = {
  'common.selectedText': '選択したテキスト',
  'common.commentPlaceholder': 'コメントを追加（任意）…',
  'common.cancel': 'キャンセル',
  'common.close': '閉じる',
  'common.save': '保存',

  'toolbar.aria': '選択範囲の操作',
  'toolbar.commentHint': '注釈を追加…',
  'toolbar.copy': 'コピー',
  'toolbar.openLink': 'リンクを開く',
  'toolbar.copyFailed': 'コピーできませんでした',
  'toolbar.addToTask': 'タスクに追加',
  'toolbar.commentDialogAria': '任意のコメントを追加',
  'toolbar.skipComment': 'コメントなし',
  'toolbar.addComment': 'コメントを追加',
  'toolbar.askInSide': 'サイドで質問',
  'toolbar.sideTaskFailed': 'サイドタスクを開始できませんでした',
  'toolbar.sideTaskUnavailable': 'この画面ではサイドタスクを使えません',
  'sideTask.title': 'サイドで質問',
  'sideTask.placeholder': 'この箇所について質問…',
  'sideTask.send': '送信',
  'sideTask.sending': '作成中…',

  'model.follow': 'メインの会話に合わせる',
  'model.releaseBadge': '1017',
  'model.triggerFallback': 'モデルを選択',
  'model.triggerLoading': 'モデルを読み込み中…',
  'model.triggerAria': 'モデルを選択、現在 {model}',
  'model.triggerAriaEffort': 'モデルを選択、現在 {model}、推論レベル {effort}',
  'model.menuAria': 'モデルと推論レベル',
  'model.model': 'モデル',
  'model.effort': '推論レベル',
  'model.providerDefault': 'デフォルト',
  'model.providerAccount': 'DeepSeek アカウント',
  'model.statusLoading': 'モデル一覧を更新中…',
  'model.errorAction': 'モデルの操作に失敗しました：{message}',
  'model.groupLoad': '{name} を読み込めませんでした：{message}',
  'model.retry': '再読み込み',
  'model.searchPlaceholder': 'モデルを検索…',
  'model.searchClear': '検索をクリア',
  'model.searchEmpty': '一致するモデルはありません。',
  'model.emptyModels': '利用できるモデルはありません。',
  'model.emptyEfforts': 'このモデルには推論レベルがありません。',

  'menu.aria': '選択メニュー',
  'menu.shortcutLabel': '選択メニューを開く',
  'menu.addShortcutLabel': '選択したテキストをタスクに追加',
  'menu.noSelection': '先に会話内のテキストを選択してください',
  'menu.busy': '先に現在の注釈を完了してください',

  'summary.hint': 'ホバーで注釈を表示',
  'summary.hintTouch': 'タップで注釈を表示',
  'summary.dialogAria': '選択範囲の注釈 {count} 件',
  'summary.edit': '注釈 {index} を編集',
  'summary.remove': '注釈 {index} を削除',
  'summary.userComment': 'ユーザーのコメント',
  'summary.noComment': 'コメントなし',
  'summary.aria.other': '選択範囲の注釈 {count} 件。開いて詳細を表示します。',
  'summary.title.other': '注釈 {count} 件',
  'summary.removeAll': '選択範囲の注釈をすべて削除',

  'chip.annotation': '注釈 {index}',
  'chip.previewAria': '注釈のプレビュー',
  'mark.previewAria': '注釈 {index} を表示',
  'chip.jump': '原文',
  'chip.jumpAria': '原文へ移動',

  'settings.trigger': '選択の入口',
  'settings.triggerHint': 'テキストを選択したときに操作バーを表示する条件。タッチ画面では常に下部のバーを使います。',
  'settings.trigger.auto': '自動表示',
  'settings.trigger.contextmenu': '右クリック',
  'settings.trigger.both': '両方',
  'settings.shortcut': 'ショートカット',
  'settings.shortcutHint': 'オンにすると、選択したテキストで次のショートカットを使えます。ホストの「キーボードショートカット」設定で変更できます。',
  'settings.shortcutListAria': '現在のショートカット',
  'settings.shortcutUnavailable': 'ショートカットを使えません（別のプラグインがキーを使用している可能性があります）。',
  'settings.shortcutUnbound': '未割り当て',
  'settings.shortcutConflict': '別のショートカットと競合しています',
  'settings.sideTaskMode': 'サイドタスクのサブエージェント',
  'settings.sideTaskModeHint':
    '質問ごとにサブエージェントを作るか、同じサイド用サブエージェントを使い回します。使い回すと一覧には 1 件だけ残りますが、引き継ぐ文脈は最初の作成時点で止まります。',
  'settings.sideTaskMode.separate': '毎回新規',
  'settings.sideTaskMode.reuse': '同じものを使い回す',
}

const es: LocaleDict = {
  'common.selectedText': 'Texto seleccionado',
  'common.commentPlaceholder': 'Añadir un comentario opcional…',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.save': 'Guardar',

  'toolbar.aria': 'Acciones de selección',
  'toolbar.commentHint': 'Añadir anotación…',
  'toolbar.copy': 'Copiar',
  'toolbar.openLink': 'Abrir enlace',
  'toolbar.copyFailed': 'No se pudo copiar',
  'toolbar.addToTask': 'Añadir a la tarea',
  'toolbar.commentDialogAria': 'Añadir un comentario opcional',
  'toolbar.skipComment': 'Omitir comentario',
  'toolbar.addComment': 'Añadir comentario',
  'toolbar.askInSide': 'Preguntar en tarea lateral',
  'toolbar.sideTaskFailed': 'No se pudo iniciar la tarea lateral',
  'toolbar.sideTaskUnavailable': 'La tarea lateral no está disponible aquí',
  'sideTask.title': 'Preguntar en tarea lateral',
  'sideTask.placeholder': 'Pregunta sobre este pasaje…',
  'sideTask.send': 'Enviar',
  'sideTask.sending': 'Creando…',

  'model.follow': 'Seguir la conversación principal',
  'model.releaseBadge': '1017',
  'model.triggerFallback': 'Seleccionar modelo',
  'model.triggerLoading': 'Cargando modelos…',
  'model.triggerAria': 'Seleccionar modelo, actual {model}',
  'model.triggerAriaEffort': 'Seleccionar modelo, actual {model}, nivel de razonamiento {effort}',
  'model.menuAria': 'Modelo y nivel de razonamiento',
  'model.model': 'Modelo',
  'model.effort': 'Razonamiento',
  'model.providerDefault': 'Predeterminado',
  'model.providerAccount': 'Cuenta de DeepSeek',
  'model.statusLoading': 'Actualizando la lista de modelos…',
  'model.errorAction': 'Falló la operación del modelo: {message}',
  'model.groupLoad': 'No se pudo cargar {name}: {message}',
  'model.retry': 'Recargar',
  'model.searchPlaceholder': 'Buscar modelos…',
  'model.searchClear': 'Borrar búsqueda',
  'model.searchEmpty': 'No hay modelos coincidentes.',
  'model.emptyModels': 'No hay modelos disponibles.',
  'model.emptyEfforts': 'Este modelo no ofrece niveles de razonamiento.',

  'menu.aria': 'Menú de selección',
  'menu.shortcutLabel': 'Abrir el menú de selección',
  'menu.addShortcutLabel': 'Añadir el texto seleccionado a la tarea',
  'menu.noSelection': 'Selecciona primero texto en la conversación',
  'menu.busy': 'Termina primero la anotación actual',

  'summary.hint': 'Pasa el cursor para ver las anotaciones',
  'summary.hintTouch': 'Toca para ver las anotaciones',
  'summary.dialogAria': 'Detalles de las anotaciones: {count}',
  'summary.edit': 'Editar anotación {index}',
  'summary.remove': 'Quitar anotación {index}',
  'summary.userComment': 'Comentario del usuario',
  'summary.noComment': 'Sin comentario',
  'summary.aria.one': '{count} anotación. Abre para ver los detalles.',
  'summary.aria.other': '{count} anotaciones. Abre para ver los detalles.',
  'summary.title.one': '{count} anotación',
  'summary.title.other': '{count} anotaciones',
  'summary.removeAll': 'Quitar todas las anotaciones',

  'chip.annotation': 'Anotación {index}',
  'chip.previewAria': 'Vista previa de la anotación',
  'mark.previewAria': 'Ver la anotación {index}',
  'chip.jump': 'Original',
  'chip.jumpAria': 'Ir al original',

  'settings.trigger': 'Activación',
  'settings.triggerHint': 'Cuándo aparece la barra de acciones al seleccionar texto. En pantallas táctiles siempre se usa la barra inferior.',
  'settings.trigger.auto': 'Automática',
  'settings.trigger.contextmenu': 'Clic derecho',
  'settings.trigger.both': 'Ambas',
  'settings.shortcut': 'Atajo',
  'settings.shortcutHint': 'Si está activado, los atajos siguientes funcionan con el texto seleccionado. Puedes cambiarlos en los ajustes de atajos de teclado del host.',
  'settings.shortcutListAria': 'Atajos activos',
  'settings.shortcutUnavailable': 'Los atajos no están disponibles (quizá otro complemento ya usa esas teclas).',
  'settings.shortcutUnbound': 'Sin asignar',
  'settings.shortcutConflict': 'Entra en conflicto con otro atajo',
  'settings.sideTaskMode': 'Subagente de tarea lateral',
  'settings.sideTaskModeHint':
    'Crea un subagente para cada pregunta o reutiliza uno solo para las tareas laterales. Al reutilizarlo queda una única entrada en el catálogo, pero el contexto heredado se detiene en su primera creación.',
  'settings.sideTaskMode.separate': 'Nuevo cada vez',
  'settings.sideTaskMode.reuse': 'Reutilizar uno',
}

const fr: LocaleDict = {
  'common.selectedText': 'Texte sélectionné',
  'common.commentPlaceholder': 'Ajouter un commentaire facultatif…',
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',
  'common.save': 'Enregistrer',

  'toolbar.aria': 'Actions sur la sélection',
  'toolbar.commentHint': 'Ajouter une annotation…',
  'toolbar.copy': 'Copier',
  'toolbar.openLink': 'Ouvrir le lien',
  'toolbar.copyFailed': 'Copie impossible',
  'toolbar.addToTask': 'Ajouter à la tâche',
  'toolbar.commentDialogAria': 'Ajouter un commentaire facultatif',
  'toolbar.skipComment': 'Sans commentaire',
  'toolbar.addComment': 'Ajouter un commentaire',
  'toolbar.askInSide': 'Demander dans une tâche latérale',
  'toolbar.sideTaskFailed': 'Impossible de démarrer la tâche latérale',
  'toolbar.sideTaskUnavailable': 'La tâche latérale n’est pas disponible ici',
  'sideTask.title': 'Demander dans une tâche latérale',
  'sideTask.placeholder': 'Posez une question sur ce passage…',
  'sideTask.send': 'Envoyer',
  'sideTask.sending': 'Création…',

  'model.follow': 'Suivre la conversation principale',
  'model.releaseBadge': '1017',
  'model.triggerFallback': 'Choisir un modèle',
  'model.triggerLoading': 'Chargement des modèles…',
  'model.triggerAria': 'Choisir un modèle, actuel {model}',
  'model.triggerAriaEffort': 'Choisir un modèle, actuel {model}, niveau de raisonnement {effort}',
  'model.menuAria': 'Modèle et niveau de raisonnement',
  'model.model': 'Modèle',
  'model.effort': 'Raisonnement',
  'model.providerDefault': 'Par défaut',
  'model.providerAccount': 'Compte DeepSeek',
  'model.statusLoading': 'Actualisation de la liste des modèles…',
  'model.errorAction': 'Échec de l’opération sur le modèle : {message}',
  'model.groupLoad': 'Échec du chargement de {name} : {message}',
  'model.retry': 'Recharger',
  'model.searchPlaceholder': 'Rechercher des modèles…',
  'model.searchClear': 'Effacer la recherche',
  'model.searchEmpty': 'Aucun modèle correspondant.',
  'model.emptyModels': 'Aucun modèle disponible.',
  'model.emptyEfforts': 'Ce modèle ne propose pas de niveau de raisonnement.',

  'menu.aria': 'Menu de sélection',
  'menu.shortcutLabel': 'Ouvrir le menu de sélection',
  'menu.addShortcutLabel': 'Ajouter le texte sélectionné à la tâche',
  'menu.noSelection': 'Sélectionnez d’abord du texte dans la conversation',
  'menu.busy': 'Terminez d’abord l’annotation en cours',

  'summary.hint': 'Survolez pour voir les annotations',
  'summary.hintTouch': 'Touchez pour voir les annotations',
  'summary.dialogAria': 'Détails des annotations : {count}',
  'summary.edit': 'Modifier l’annotation {index}',
  'summary.remove': 'Supprimer l’annotation {index}',
  'summary.userComment': 'Commentaire de l’utilisateur',
  'summary.noComment': 'Aucun commentaire',
  'summary.aria.one': '{count} annotation. Ouvrez pour voir les détails.',
  'summary.aria.other': '{count} annotations. Ouvrez pour voir les détails.',
  'summary.title.one': '{count} annotation',
  'summary.title.other': '{count} annotations',
  'summary.removeAll': 'Supprimer toutes les annotations',

  'chip.annotation': 'Annotation {index}',
  'chip.previewAria': 'Aperçu de l’annotation',
  'mark.previewAria': 'Voir l’annotation {index}',
  'chip.jump': 'Original',
  'chip.jumpAria': 'Aller à l’original',

  'settings.trigger': 'Déclencheur',
  'settings.triggerHint': 'Quand la barre d’actions apparaît après une sélection de texte. Sur écran tactile, la barre inférieure est toujours utilisée.',
  'settings.trigger.auto': 'Automatique',
  'settings.trigger.contextmenu': 'Clic droit',
  'settings.trigger.both': 'Les deux',
  'settings.shortcut': 'Raccourci',
  'settings.shortcutHint': 'Une fois activé, les raccourcis ci-dessous s’appliquent au texte sélectionné. Modifiez-les dans les réglages de raccourcis clavier de l’hôte.',
  'settings.shortcutListAria': 'Raccourcis actifs',
  'settings.shortcutUnavailable': 'Raccourcis indisponibles (touches peut-être déjà utilisées par une autre extension).',
  'settings.shortcutUnbound': 'Non assigné',
  'settings.shortcutConflict': 'Conflit avec un autre raccourci',
  'settings.sideTaskMode': 'Sous-agent de tâche latérale',
  'settings.sideTaskModeHint':
    'Créez un sous-agent pour chaque question ou réutilisez un seul sous-agent latéral. La réutilisation ne laisse qu’une entrée dans le catalogue, mais le contexte hérité s’arrête à sa première création.',
  'settings.sideTaskMode.separate': 'Nouveau à chaque fois',
  'settings.sideTaskMode.reuse': 'Réutiliser un seul',
}

const de: LocaleDict = {
  'common.selectedText': 'Ausgewählter Text',
  'common.commentPlaceholder': 'Optionalen Kommentar hinzufügen…',
  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.save': 'Speichern',

  'toolbar.aria': 'Aktionen für die Auswahl',
  'toolbar.commentHint': 'Anmerkung hinzufügen…',
  'toolbar.copy': 'Kopieren',
  'toolbar.openLink': 'Link öffnen',
  'toolbar.copyFailed': 'Kopieren fehlgeschlagen',
  'toolbar.addToTask': 'Zur Aufgabe hinzufügen',
  'toolbar.commentDialogAria': 'Optionalen Kommentar hinzufügen',
  'toolbar.skipComment': 'Ohne Kommentar',
  'toolbar.addComment': 'Kommentar hinzufügen',
  'toolbar.askInSide': 'In Seitenaufgabe fragen',
  'toolbar.sideTaskFailed': 'Seitenaufgabe konnte nicht gestartet werden',
  'toolbar.sideTaskUnavailable': 'Die Seitenaufgabe ist hier nicht verfügbar',
  'sideTask.title': 'In Seitenaufgabe fragen',
  'sideTask.placeholder': 'Frage zu dieser Passage stellen…',
  'sideTask.send': 'Senden',
  'sideTask.sending': 'Wird erstellt…',

  'model.follow': 'Hauptgespräch folgen',
  'model.releaseBadge': '1017',
  'model.triggerFallback': 'Modell wählen',
  'model.triggerLoading': 'Modelle werden geladen…',
  'model.triggerAria': 'Modell wählen, aktuell {model}',
  'model.triggerAriaEffort': 'Modell wählen, aktuell {model}, Denkstufe {effort}',
  'model.menuAria': 'Modell und Denkstufe',
  'model.model': 'Modell',
  'model.effort': 'Denkstufe',
  'model.providerDefault': 'Standard',
  'model.providerAccount': 'DeepSeek-Konto',
  'model.statusLoading': 'Modellliste wird aktualisiert…',
  'model.errorAction': 'Modellvorgang fehlgeschlagen: {message}',
  'model.groupLoad': '{name} konnte nicht geladen werden: {message}',
  'model.retry': 'Neu laden',
  'model.searchPlaceholder': 'Modelle suchen…',
  'model.searchClear': 'Suche löschen',
  'model.searchEmpty': 'Keine passenden Modelle.',
  'model.emptyModels': 'Keine Modelle verfügbar.',
  'model.emptyEfforts': 'Dieses Modell bietet keine Denkstufen.',

  'menu.aria': 'Auswahlmenü',
  'menu.shortcutLabel': 'Auswahlmenü öffnen',
  'menu.addShortcutLabel': 'Ausgewählten Text zur Aufgabe hinzufügen',
  'menu.noSelection': 'Wähle zuerst Text im Gespräch aus',
  'menu.busy': 'Schließe zuerst die aktuelle Anmerkung ab',

  'summary.hint': 'Zum Anzeigen der Anmerkungen darüberfahren',
  'summary.hintTouch': 'Zum Anzeigen der Anmerkungen tippen',
  'summary.dialogAria': 'Anmerkungsdetails: {count}',
  'summary.edit': 'Anmerkung {index} bearbeiten',
  'summary.remove': 'Anmerkung {index} entfernen',
  'summary.userComment': 'Benutzerkommentar',
  'summary.noComment': 'Kein Kommentar',
  'summary.aria.one': '{count} Anmerkung. Zum Anzeigen der Details öffnen.',
  'summary.aria.other': '{count} Anmerkungen. Zum Anzeigen der Details öffnen.',
  'summary.title.one': '{count} Anmerkung',
  'summary.title.other': '{count} Anmerkungen',
  'summary.removeAll': 'Alle Anmerkungen entfernen',

  'chip.annotation': 'Anmerkung {index}',
  'chip.previewAria': 'Anmerkungsvorschau',
  'mark.previewAria': 'Anmerkung {index} anzeigen',
  'chip.jump': 'Original',
  'chip.jumpAria': 'Zum Original springen',

  'settings.trigger': 'Auslöser',
  'settings.triggerHint': 'Wann die Aktionsleiste nach einer Textauswahl erscheint. Auf Touchscreens wird immer die untere Leiste verwendet.',
  'settings.trigger.auto': 'Automatisch',
  'settings.trigger.contextmenu': 'Rechtsklick',
  'settings.trigger.both': 'Beides',
  'settings.shortcut': 'Tastenkürzel',
  'settings.shortcutHint': 'Wenn aktiviert, gelten die folgenden Kürzel für den ausgewählten Text. Ändern lässt sich das in den Tastenkürzel-Einstellungen des Hosts.',
  'settings.shortcutListAria': 'Aktive Kürzel',
  'settings.shortcutUnavailable': 'Kürzel nicht verfügbar (möglicherweise von einem anderen Plugin belegt).',
  'settings.shortcutUnbound': 'Nicht belegt',
  'settings.shortcutConflict': 'Konflikt mit einem anderen Kürzel',
  'settings.sideTaskMode': 'Subagent für Seitenaufgaben',
  'settings.sideTaskModeHint':
    'Lege für jede Frage einen Subagenten an oder nutze einen gemeinsamen Seiten-Subagenten. Bei Wiederverwendung bleibt nur ein Katalogeintrag, aber der übernommene Kontext endet bei der ersten Erstellung.',
  'settings.sideTaskMode.separate': 'Jedes Mal neu',
  'settings.sideTaskMode.reuse': 'Einen wiederverwenden',
}

/**
 * Russian and Portuguese are Host language packs from 0.2.2-alpha.2 on; older
 * Hosts do not ship them, so the plugin adds them through
 * `ctx.locale.addLanguage()` and their dictionaries through the three-argument
 * `register()`. Their fallback chains end at `en`, as the host requires.
 */
const ru: LocaleDict = {
  'common.selectedText': 'Выделенный текст',
  'common.commentPlaceholder': 'Добавить необязательный комментарий…',
  'common.cancel': 'Отмена',
  'common.close': 'Закрыть',
  'common.save': 'Сохранить',

  'toolbar.aria': 'Действия с выделенным текстом',
  'toolbar.commentHint': 'Добавить аннотацию…',
  'toolbar.copy': 'Копировать',
  'toolbar.openLink': 'Открыть ссылку',
  'toolbar.copyFailed': 'Не удалось скопировать',
  'toolbar.addToTask': 'Добавить к задаче',
  'toolbar.commentDialogAria': 'Добавить необязательный комментарий',
  'toolbar.skipComment': 'Без комментария',
  'toolbar.addComment': 'Добавить комментарий',
  'toolbar.askInSide': 'Спросить в боковой задаче',
  'toolbar.sideTaskFailed': 'Не удалось открыть боковую задачу',
  'toolbar.sideTaskUnavailable': 'Боковая задача недоступна в этом окне',
  'sideTask.title': 'Спросить в боковой задаче',
  'sideTask.placeholder': 'Спросите об этом фрагменте…',
  'sideTask.send': 'Отправить',
  'sideTask.sending': 'Создание…',

  'model.follow': 'Как в основном диалоге',
  'model.releaseBadge': '1017',
  'model.triggerFallback': 'Выберите модель',
  'model.triggerLoading': 'Загрузка моделей…',
  'model.triggerAria': 'Выбрать модель, текущая {model}',
  'model.triggerAriaEffort': 'Выбрать модель, текущая {model}, уровень рассуждения {effort}',
  'model.menuAria': 'Модель и уровень рассуждения',
  'model.model': 'Модель',
  'model.effort': 'Уровень рассуждения',
  'model.providerDefault': 'По умолчанию',
  'model.providerAccount': 'Аккаунт DeepSeek',
  'model.statusLoading': 'Обновление списка моделей…',
  'model.errorAction': 'Не удалось выполнить операцию с моделью: {message}',
  'model.groupLoad': 'Не удалось загрузить {name}: {message}',
  'model.retry': 'Повторить',
  'model.searchPlaceholder': 'Поиск моделей…',
  'model.searchClear': 'Очистить поиск',
  'model.searchEmpty': 'Нет подходящих моделей.',
  'model.emptyModels': 'Нет доступных моделей.',
  'model.emptyEfforts': 'Эта модель не предоставляет уровни рассуждения.',

  'menu.aria': 'Меню выделения',
  'menu.shortcutLabel': 'Открыть меню выделения',
  'menu.addShortcutLabel': 'Добавить выделенный текст к задаче',
  'menu.noSelection': 'Сначала выделите текст в диалоге',
  'menu.busy': 'Сначала завершите текущую аннотацию',

  'summary.hint': 'Наведите, чтобы увидеть аннотации',
  'summary.hintTouch': 'Нажмите, чтобы увидеть аннотации',
  'summary.dialogAria': 'Детали аннотаций: {count}',
  'summary.edit': 'Изменить аннотацию {index}',
  'summary.remove': 'Удалить аннотацию {index}',
  'summary.userComment': 'Комментарий пользователя',
  'summary.noComment': 'Комментарий не добавлен',
  'summary.aria.one': '{count} аннотация. Откройте, чтобы увидеть подробности.',
  'summary.aria.few': '{count} аннотации. Откройте, чтобы увидеть подробности.',
  'summary.aria.many': '{count} аннотаций. Откройте, чтобы увидеть подробности.',
  'summary.aria.other': '{count} аннотаций. Откройте, чтобы увидеть подробности.',
  'summary.title.one': '{count} аннотация',
  'summary.title.few': '{count} аннотации',
  'summary.title.many': '{count} аннотаций',
  'summary.title.other': '{count} аннотаций',
  'summary.removeAll': 'Удалить все аннотации',

  'chip.annotation': 'Аннотация {index}',
  'chip.previewAria': 'Просмотр аннотации',
  'mark.previewAria': 'Открыть аннотацию {index}',
  'chip.jump': 'Оригинал',
  'chip.jumpAria': 'Перейти к оригиналу',

  'settings.trigger': 'Триггер',
  'settings.triggerHint': 'Когда показывать панель действий после выделения текста. На сенсорных экранах всегда используется нижняя панель.',
  'settings.trigger.auto': 'Автоматически',
  'settings.trigger.contextmenu': 'По правому клику',
  'settings.trigger.both': 'Оба способа',
  'settings.shortcut': 'Горячая клавиша',
  'settings.shortcutHint': 'Когда включено, сочетания ниже работают с выделенным текстом. Изменить их можно в настройках горячих клавиш.',
  'settings.shortcutListAria': 'Текущие сочетания',
  'settings.shortcutUnavailable': 'Сочетания недоступны (возможно, клавиши заняты другим плагином).',
  'settings.shortcutUnbound': 'Не назначено',
  'settings.shortcutConflict': 'Конфликтует с другим сочетанием',
  'settings.sideTaskMode': 'Подагент боковых задач',
  'settings.sideTaskModeHint':
    'Создавать подагента для каждого вопроса или использовать одного на все боковые вопросы. При повторном использовании в списке остаётся одна запись, но унаследованный контекст фиксируется при создании.',
  'settings.sideTaskMode.separate': 'Новый каждый раз',
  'settings.sideTaskMode.reuse': 'Один общий',
}

const pt: LocaleDict = {
  'common.selectedText': 'Texto selecionado',
  'common.commentPlaceholder': 'Adicionar um comentário opcional…',
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.save': 'Salvar',

  'toolbar.aria': 'Ações da seleção',
  'toolbar.commentHint': 'Adicionar anotação…',
  'toolbar.copy': 'Copiar',
  'toolbar.openLink': 'Abrir link',
  'toolbar.copyFailed': 'Falha ao copiar',
  'toolbar.addToTask': 'Adicionar à tarefa',
  'toolbar.commentDialogAria': 'Adicionar um comentário opcional',
  'toolbar.skipComment': 'Sem comentário',
  'toolbar.addComment': 'Adicionar comentário',
  'toolbar.askInSide': 'Perguntar na tarefa lateral',
  'toolbar.sideTaskFailed': 'Não foi possível iniciar a tarefa lateral',
  'toolbar.sideTaskUnavailable': 'A tarefa lateral não está disponível aqui',
  'sideTask.title': 'Perguntar na tarefa lateral',
  'sideTask.placeholder': 'Pergunte sobre esta passagem…',
  'sideTask.send': 'Enviar',
  'sideTask.sending': 'Criando…',

  'model.follow': 'Seguir a conversa principal',
  'model.releaseBadge': '1017',
  'model.triggerFallback': 'Selecionar modelo',
  'model.triggerLoading': 'Carregando modelos…',
  'model.triggerAria': 'Selecionar modelo, atual {model}',
  'model.triggerAriaEffort': 'Selecionar modelo, atual {model}, nível de raciocínio {effort}',
  'model.menuAria': 'Modelo e nível de raciocínio',
  'model.model': 'Modelo',
  'model.effort': 'Raciocínio',
  'model.providerDefault': 'Padrão',
  'model.providerAccount': 'Conta DeepSeek',
  'model.statusLoading': 'Atualizando a lista de modelos…',
  'model.errorAction': 'Falha na operação do modelo: {message}',
  'model.groupLoad': 'Falha ao carregar {name}: {message}',
  'model.retry': 'Recarregar',
  'model.searchPlaceholder': 'Pesquisar modelos…',
  'model.searchClear': 'Limpar pesquisa',
  'model.searchEmpty': 'Nenhum modelo correspondente.',
  'model.emptyModels': 'Nenhum modelo disponível.',
  'model.emptyEfforts': 'Este modelo não oferece níveis de raciocínio.',

  'menu.aria': 'Menu de seleção',
  'menu.shortcutLabel': 'Abrir o menu de seleção',
  'menu.addShortcutLabel': 'Adicionar o texto selecionado à tarefa',
  'menu.noSelection': 'Selecione primeiro um texto na conversa',
  'menu.busy': 'Conclua a anotação atual primeiro',

  'summary.hint': 'Passe o cursor para ver as anotações',
  'summary.hintTouch': 'Toque para ver as anotações',
  'summary.dialogAria': 'Detalhes das anotações: {count}',
  'summary.edit': 'Editar anotação {index}',
  'summary.remove': 'Remover anotação {index}',
  'summary.userComment': 'Comentário do usuário',
  'summary.noComment': 'Sem comentário',
  'summary.aria.one': '{count} anotação. Abra para ver os detalhes.',
  'summary.aria.other': '{count} anotações. Abra para ver os detalhes.',
  'summary.title.one': '{count} anotação',
  'summary.title.other': '{count} anotações',
  'summary.removeAll': 'Remover todas as anotações',

  'chip.annotation': 'Anotação {index}',
  'chip.previewAria': 'Prévia da anotação',
  'mark.previewAria': 'Ver a anotação {index}',
  'chip.jump': 'Original',
  'chip.jumpAria': 'Ir para o original',

  'settings.trigger': 'Gatilho',
  'settings.triggerHint': 'Quando a barra de ações aparece após selecionar texto. Em telas de toque, a barra inferior é sempre usada.',
  'settings.trigger.auto': 'Automático',
  'settings.trigger.contextmenu': 'Clique direito',
  'settings.trigger.both': 'Ambos',
  'settings.shortcut': 'Atalho',
  'settings.shortcutHint': 'Quando ativado, os atalhos abaixo funcionam no texto selecionado. Altere-os nas configurações de atalhos de teclado do host.',
  'settings.shortcutListAria': 'Atalhos ativos',
  'settings.shortcutUnavailable': 'Atalhos indisponíveis (as teclas podem estar em uso por outro plugin).',
  'settings.shortcutUnbound': 'Não atribuído',
  'settings.shortcutConflict': 'Conflita com outro atalho',
  'settings.sideTaskMode': 'Subagente de tarefa lateral',
  'settings.sideTaskModeHint':
    'Crie um subagente para cada pergunta ou reutilize um único subagente lateral. A reutilização deixa apenas uma entrada no catálogo, mas o contexto herdado para na primeira criação.',
  'settings.sideTaskMode.separate': 'Novo a cada vez',
  'settings.sideTaskMode.reuse': 'Reutilizar um',
}

/** Both baseline host locales, required together by the typed `register()`. */
export const SHIPPED_DICTS: Readonly<Record<'zh' | 'en', LocaleDict>> = Object.freeze({ zh, en })

/**
 * Language packs the Host ships from 0.2.2-alpha.2 on. Older Hosts only carry
 * `zh` / `en`, so the plugin adds each missing pack through `addLanguage()`;
 * the ids and labels match the Host's own so a later Host upgrade keeps the
 * same settings entry.
 */
export const OPTIONAL_LANGUAGES = Object.freeze([
  { id: 'ja', label: '日本語', fallback: 'en' as const },
  { id: 'es', label: 'Español', fallback: 'en' as const },
  { id: 'fr', label: 'Français', fallback: 'en' as const },
  { id: 'de', label: 'Deutsch', fallback: 'en' as const },
  { id: 'ru', label: 'Русский', fallback: 'en' as const },
  { id: 'pt', label: 'Português', fallback: 'en' as const },
])

/** Every dictionary this plugin serves, keyed by language id. */
export const DICTIONARIES: Readonly<Record<string, LocaleDict>> = Object.freeze({
  zh,
  en,
  ja,
  es,
  fr,
  de,
  ru,
  pt,
})

export interface LocaleApi {
  translate(key: string, params?: Record<string, unknown>): string
  getActive(): string
  getRevision(): number
  subscribe(listener: () => void): () => void
}

let api: LocaleApi | undefined

/**
 * Install the host-bound translation entry point. Called once from `apply()`
 * with `ctx.locale.bind(LOCALE_NS)` and the live snapshot accessors.
 */
export function bindLocale(next: LocaleApi): void {
  api = next
}

/** Active language id, or `en` before the host service is bound. */
export function activeLocale(): string {
  return api?.getActive() ?? 'en'
}

/** Languages whose CLDR rule for the counts this UI renders is one/other. */
const ONE_OTHER_LOCALES = new Set(['en', 'es', 'fr', 'de', 'pt'])

function pluralForm(count: number): PluralForm {
  const locale = activeLocale()
  if (locale === 'ru') {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return 'one'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
    return 'many'
  }
  if (ONE_OTHER_LOCALES.has(locale)) return count === 1 ? 'one' : 'other'
  return 'other'
}

/**
 * Translate a `select-quote` key. A numeric `count` selects a plural form and
 * the matching `key.form` entry is used, falling back to `key.other`.
 */
export function t(key: string, params: Record<string, unknown> = {}): string {
  if (!api) return key
  if (typeof params.count === 'number') {
    const form = pluralForm(params.count)
    const exact = api.translate(`${key}.${form}`, params)
    if (exact !== `${key}.${form}`) return exact
    const other = api.translate(`${key}.other`, params)
    if (other !== `${key}.other`) return other
  }
  return api.translate(key, params)
}

/**
 * Subscribe to language or dictionary changes. Components go through
 * `useLocale()` instead; this is the non-React entry point (DOM decorations).
 * Subscribing before the host service is bound is a no-op, so callers subscribe
 * from `apply()`, after `bindLocale()`.
 */
export function subscribeLocale(listener: () => void): () => void {
  return api ? api.subscribe(listener) : () => {}
}

/** Monotonic host revision counter, bumped on locale and dictionary changes. */
export function localeRevision(): number {
  return api?.getRevision() ?? 0
}
