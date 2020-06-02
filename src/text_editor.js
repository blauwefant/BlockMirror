function BlockMirrorTextEditor(blockMirror) {
    this.blockMirror = blockMirror;
    this.textContainer = blockMirror.tags.textContainer;
    this.textArea = blockMirror.tags.textArea;
    this.textSidebar = blockMirror.tags.textSidebar;

    this.highlightedHandles = [];

    // notification
    this.silentEvents_ = false;

    // Do we need to force an update?
    this.outOfDate_ = null;

    // Use a timer to swallow updates
    this.updateTimer_ = null;

    let codeMirrorOptions = {
        mode: {
            name: 'python',
            version: 3,
            singleLineStringErrors: false
        },
        readOnly: blockMirror.configuration.readOnly,
        showCursorWhenSelecting: true,
        lineNumbers: true,
        firstLineNumber: 1,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        matchBrackets: true,
        extraKeys: {
            'Tab': 'indentMore',
            'Shift-Tab': 'indentLess',
            'Ctrl-Enter': blockMirror.run,
            'Esc': function(cm) {
                if (cm.getOption("fullScreen")) {
                    cm.setOption("fullScreen", false);
                } else {
                    cm.display.input.blur();
                }
            },
            "F11": function(cm) {
                cm.setOption("fullScreen", !cm.getOption("fullScreen"));
            },
        },
        // TODO: Hide gutters when short on space
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
    };
    this.codeMirror = CodeMirror.fromTextArea(this.textArea, codeMirrorOptions);
    this.codeMirror.on('change', this.changed.bind(this));
    this.codeMirror.setSize(null, '100%');
    this.textContainer.style.border = '1px solid lightgray';
    this.textContainer.style.float = 'left';
    this.updateWidth();
    this.textContainer.style.height = blockMirror.configuration.height;
    // Style sidebar
    this.textSidebar.style.height = '100%';
    this.textSidebar.style.float = 'left';
    this.textSidebar.style.backgroundColor = '#ddd';

    window.addEventListener('resize', this.resizeResponsively.bind(this), false);

    // TODO: Finish implementing code completion
    /*this.codeMirror.on('inputRead', function onChange(editor, input) {
        if (input.text[0] === ';' || input.text[0] === ' ' || input.text[0] === ":") {
            return;
        }
        editor.showHint({
            hint: CodeMirror.pythonHint
        });
    });*/
    //https://i.imgur.com/ITZKRiq.png
    this.codeMirror.on("beforeChange", (cm, change) => {
        if (change.origin === "paste") {
            let newText = change.text[0];
            if (this.isImageUrl(newText)) {
                change.update(null, null, [`"${newText}"`]);
            }
        }
    });
    this.codeMirror.on("change", (cm, change) => {
        console.log(change);
        let lastLine;
        if(change.origin === "paste" || change.origin === "setValue") {
            //"https://game-icons.net/icons/ffffff/000000/1x1/delapouite/labrador-head.png"
            lastLine = change.from.line+change.text.length;
        } else {
            lastLine = Math.max(1+change.to.line, change.text.length);
        }
        cm.doc.eachLine(change.from.line, lastLine, (line) => {
            let match;
            while ((match = HAS_IMAGE_URL.exec(line.text)) !== null) {
                let imageWidget = this.makeImageWidget(match[2]);
                let imageMarker = cm.markText({line: cm.doc.getLineNumber(line), ch: match.index},
                    {line: cm.doc.getLineNumber(line), ch: match.index+match[0].length},
                    {atomic: true, replacedWith: imageWidget});
                imageWidget.onclick = (x) => imageMarker.clear();
            }
        });
    });

}

//BlockMirrorTextEditor.prototype.enableImages = function (url) {
//BlockMirrorTextEditor.prototype.disableImage = function (url) {

BlockMirrorTextEditor.prototype.makeImageWidget = function (url) {
    let x = document.createElement("IMG");
    x.setAttribute("src", url);
    x.setAttribute("height", "40");
    x.setAttribute("width", "40");
    x.setAttribute("alt", url);
    x.onmouseover = (x) => console.log("Turn it off");
    return x;
};

//'https://game-icons.net/icons/ffffff/000000/1x1/delapouite/labrador-head.png'
const FULL_IMAGE_URL = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+(?:png|jpg|jpeg|gif|svg)+$/;
const HAS_IMAGE_URL = /(["'])((?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+(?:png|jpg|jpeg|gif|svg)+)\1/g;
BlockMirrorTextEditor.prototype.isImageUrl = function (url) {
    return url.match(FULL_IMAGE_URL);
};

BlockMirrorTextEditor.prototype.defocus = function () {
    this.codeMirror.display.input.blur();
};

BlockMirrorTextEditor.prototype.updateWidth = function () {
    //var newWidth = '0%';
    /*if (this.blockMirror.views.includes('text')) {
        newWidth = (100 / this.blockMirror.views.length)+'%';
    }
    this.textContainer.style.width = newWidth;*/
};

BlockMirrorTextEditor.prototype.setReadOnly = function (isReadOnly) {
    this.codeMirror.setOption('readOnly', isReadOnly);
};

BlockMirrorTextEditor.prototype.VIEW_CONFIGURATIONS = {
    'split': {
        'width': '40%',
        'visible': true,
        'indentSidebar': false
    },
    'text': {
        'width': '100%',
        'visible': true,
        'indentSidebar': true
    },
    'block': {
        'width': '0%',
        'visible': false,
        'indentSidebar': false
    }
};

BlockMirrorTextEditor.prototype.resizeResponsively = function () {
    let mode = this.blockMirror.mode_;
    let configuration = this.VIEW_CONFIGURATIONS[mode];
    let width = configuration.width;
    let height = this.blockMirror.configuration.height;
    if (mode === 'split') {
        if (window.innerWidth >= this.blockMirror.BREAK_WIDTH) {
            this.textContainer.style.width = width;
            this.textContainer.style.height = height+"px";
        } else {
            this.textContainer.style.width = '100%';
            this.textContainer.style.height = (height/2)+"px";
        }
    } else {
        this.textContainer.style.width = width;
        this.textContainer.style.height = height+"px";
    }
};

BlockMirrorTextEditor.prototype.setMode = function (mode) {
    mode = mode.toLowerCase();
    let configuration = this.VIEW_CONFIGURATIONS[mode];
    // If there is an update waiting and we're visible, then update
    if (this.outOfDate_ !== null && this.isVisible()) {
        this.setCode(this.outOfDate_, true);
    }
    // Show/hide editor
    this.resizeResponsively();
    if (configuration.visible) {
        this.textContainer.style.display = 'block';
        this.codeMirror.getWrapperElement().style.display = 'block';
        this.codeMirror.refresh();
    } else {
        this.textContainer.style.height = '0%';
        this.textContainer.style.display = 'none';
        this.codeMirror.getWrapperElement().style.display = 'none';
    }
    // Should we indent the toolbox
    this.updateGutter(configuration);
};

BlockMirrorTextEditor.prototype.updateGutter = function (configuration) {
    if (configuration === undefined) {
        let mode = this.blockMirror.mode_.toLowerCase();
        configuration = this.VIEW_CONFIGURATIONS[mode];
    }
    let isBigWindow = window.innerWidth >= this.blockMirror.BREAK_WIDTH;
    if (configuration.indentSidebar && isBigWindow) {
        let gutters = this.textContainer.querySelector('.CodeMirror-gutters');
        let gutterWidth = gutters.offsetWidth;
        let toolbarWidth = this.blockMirror.blockEditor.getToolbarWidth();
        let newGutterWidth = toolbarWidth - gutterWidth - 2;
        this.textSidebar.style.width = newGutterWidth + 'px';
        this.textSidebar.style.display = 'block';
    } else {
        this.textSidebar.style.display = 'none';
        this.textSidebar.style.width = '0px';
    }
};

BlockMirrorTextEditor.prototype.setCode = function (code, quietly) {
    this.silentEvents_ = quietly;

    // Defaults to a single blank line
    code = (code === undefined || code.trim() === "") ? "\n" : code;

    if (this.isVisible()) {
        this.codeMirror.setValue(code);
        this.outOfDate_ = null;
    } else {
        this.outOfDate_ = code;
    }
};

BlockMirrorTextEditor.prototype.getCode = function () {
    return this.codeMirror.getValue();
};

BlockMirrorTextEditor.prototype.changed = function (codeMirror, event) {
    if (!this.silentEvents_) {
        let handleChange = () => {
            let newCode = this.getCode();
            this.blockMirror.blockEditor.setCode(newCode, true);
            this.blockMirror.setCode(newCode, true);
        };
        if (this.blockMirror.configuration.blockDelay === false) {
            handleChange();
        } else {
            if (this.updateTimer_ !== null) {
                clearTimeout(this.updateTimer_);
            }
            this.updateTimer_ = setTimeout(handleChange, this.blockMirror.configuration.blockDelay);
        }
    }
    this.silentEvents_ = false;
};

BlockMirrorTextEditor.prototype.isVisible = function () {
    return this.blockMirror.VISIBLE_MODES.text.indexOf(this.blockMirror.mode_) !== -1;
};

BlockMirrorTextEditor.prototype.setHighlightedLines = function (lines, style) {
    let handles = lines.map((l) => { return {
        "handle": this.codeMirror.doc.addLineClass(l-1, "background", style),
        "style": style
    }});
    this.highlightedHandles = this.highlightedHandles.concat(handles);
};

BlockMirrorTextEditor.prototype.clearHighlightedLines = function () {
    if (this.highlightedHandles) {
        let removed = this.highlightedHandles.map((h) => {
            this.codeMirror.doc.removeLineClass(h.handle, "background", h.style);
            var info = this.codeMirror.doc.lineInfo(h.handle);
            if (info) {
                return info.line + 1;
            } else {
                return info;
            }
        });
        this.highlightedHandles = [];
        return removed;
    }
};


document.onpaste = function(event){
    var items = (event.clipboardData || event.originalEvent.clipboardData).items;
    console.log(JSON.stringify(items)); // will give you the mime types
    for (index in items) {
        var item = items[index];
        if (item.kind === 'file') {
            var blob = item.getAsFile();
            var reader = new FileReader();
            reader.onload = function(event){
                console.log(typeof event.target.result); // data url!
                $(".cm-embedded-image").css("background-image", "url("+event.target.result+")").css("background-size", "contain").css("background-repeat-x", "no-repeat").css("background-repeat-y", "no-repeat").css("padding-left", "30px").css("padding-bottom", "5px");
            };
            reader.readAsDataURL(blob);
        }
    }
};
