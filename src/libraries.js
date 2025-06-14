class PythonModule {
  static isA(fullName) {
    return (
      /^([a-z][a-zA-Z0-9_]*)(\.[a-z][a-zA-Z0-9_]*)*$/.test(fullName)
    );
  }

  static extractName(signature) {
    if (signature.startsWith('class ')) {
      if (!signature.includes('.')) {
        return "";
      }

      signature = signature.substr(6);
    }

    let moduleName = signature.split(/\.([A-Z][^.]*)\.?.+$/, 1)[0];

    if (PythonModule.isA(moduleName)) {
      return moduleName;
    }

    return "";
  }

  addMember(signature, inputObject) {
    const [code, comment] = signature.split("//", 2);
    let member;

    if (PythonFunction.isA(code)) {
      member = new PythonFunction(
          this,
          code,
          comment,
          inputObject?.colour ?? inputObject?.color,
      );

      for (let alias of member.aliases) {
        this.members.set(alias.name, alias);
      }
    } else {
      member = new PythonAttribute(
          this,
          code,
          comment,
          inputObject?.colour ?? inputObject?.color,
      );
    }

    this.members.set(member.name, member);
  }

  constructor(library, signature, comment, members) {
    this.library = library;
    [this.fullName, this.name] = signature.split(" as ", 2);
    if (!this.name) {
      this.name = this.fullName.substring(this.fullName.lastIndexOf(".") + 1);
    }
    this.requiresImport = this.fullName === "" ? "" : this.name === this.fullName ? this.fullName : (this.fullName + " as " + this.name);
    this.members = new Map();

    if (members !== undefined) {
      for (let input of members) {
        if (typeof input === "object") {
          if (input.signatures) {
            for (const signature of input.signatures) {
              this.addMember(signature, input)
            }
          } else {
            this.addMember(input.signature, input)
          }
        } else {
          this.addMember(input)
        }
      }
    }
  }

  toString() {
    return this.requiresImport;
  }

  toToolbox(textToBlocks) {
    let result = "";

    let originalImports = textToBlocks.imports
    try {
      textToBlocks.imports = new TypeRegistry()
      textToBlocks.imports.set(this.fullName, this.name)
      for (let value of this.members.values()) {
        result += value.toToolbox(textToBlocks) + "<sep></sep>";
      }
    } finally {
      textToBlocks.imports = originalImports
    }
    return result;
  }

  resolve(name) {
    if (name === this.fullName) {
      return this;
    }

    let memberName;

    if (name.startsWith(this.fullName + ".") && this.fullName !== "") {
      memberName = name.substring(this.fullName.length + 1);
    } else {
      memberName = name;
    }

    let indexOfDot = memberName.indexOf(".");

    if (indexOfDot === -1) {
      return this.members.get(memberName);
    }

    if (this.fullName === "" && indexOfDot === 0) {
      // Special case, look for a method in all builtin classes
      let methodName = memberName.substring(1);

      for (let member of this.members.values()) {
        if (member instanceof PythonClass) {
          let result = member.resolve(methodName)

          if (result) {
            return result
          }
        }
      }

      return null;
    }

    return this.members.get(memberName.substring(0, indexOfDot))?.resolve(
      memberName.substring(indexOfDot + 1),
    );
  }

  registerImports(typeRegistry) {
    typeRegistry.set(this.fullName, this.name)

    for (const member of this.members.values()) {
      if (member instanceof PythonClass) {
        typeRegistry.set(member.fullName, member.name)
      }
    }
  }
}

class PythonParameter {
  constructor(parameter, arg, positional, keyword) {
    this.positional = positional;
    this.keyword = keyword;

    if (parameter.startsWith("*")) {
      this.variableLength = true;

      if (parameter.startsWith("**")) {
        parameter = parameter.substring(2);
        this.keyword = true;
        this.positional = false;
      } else {
        parameter = parameter.substring(1);
        this.keyword = false;
        this.positional = true;
      }
    } else {
      this.variableLength = false;
    }
    let [nameAndTypeHint, defaultValue] = parameter.split("=", 2);
    let [name, typeHint] = nameAndTypeHint.split(":", 2);
    this.name = name.trim();
    this.typeHint = (typeHint ?? "").trim();

    // Convert double quotes to single quotes for default string values
    this.defaultValue = (defaultValue ?? "").trim().replace(/^"([^"]*)"$/, "'$1'");
    this.preferKeyword = this.positional && this.keyword

    if (arg.includes("=")) {
      let [message, value] = arg.split("=", 2);
      this.message = message.trim();
      this.value = value.trim();
    } else {
      this.message = this.name;
      this.value = arg.trim();

      if (this.value !== "") {
        this.preferKeyword = false
      }
    }

    if (this.value === python.pythonGenerator.blank) {
      // For consistency
      this.value = ""
    }
  }

  toPythonSource() {
    if (this.variableLength && this.keyword) {
      return ""
    }

    let processedValue = this.value

    if (this.value === "") {
      if (this.defaultValue === "" && !(this.variableLength && this.positional)) {
        processedValue = python.pythonGenerator.blank;
      } else {
        processedValue = this.defaultValue
      }
    }

    if (this.positional && (!this.keyword || !this.preferKeyword)) {
      // Positional only or preferred
      return processedValue;
    }
    return `${this.name} = ${processedValue}`;
  }

  #replaceTagName(element, tagName) {
    if (element.tagName === tagName) {
      return
    }

    let replacementElement = document.createElement(tagName);

    for (let i = 0, l = element.attributes.length; i < l; ++i) {
      let nodeName = element.attributes.item(i).nodeName;
      let nodeValue = element.attributes.item(i).nodeValue;
      replacementElement.setAttribute(nodeName, nodeValue);
    }

    replacementElement.innerHTML = element.innerHTML;
    element.parentNode.replaceChild(replacementElement, element);
  };

  #matchesDefaultValue(type, value) {
    if (this.defaultValue === "") {
      return value === ""
    }

    switch (type) {
      case "ast_NameConstantBoolean":
        return this.defaultValue === value || this.defaultValue === "True" && value === "TRUE" || this.defaultValue === "False" && value === "FALSE"
      case "ast_NameConstantNone":
        return this.defaultValue === "None"
      case "ast_Name":
      case "ast_Str":
      case "ast_StrChar":
        return this.defaultValue === value
      case "ast_Num":
      case "ast_UnaryOpUSub":
        return parseFloat(this.defaultValue) === parseFloat(value)
    }
    return false
  }

  #shouldShadow(argBlock) {
    if (this.defaultValue === '') {
      return false
    } else if (argBlock instanceof HTMLElement) {
      // Blockly XML
      let blockElement = argBlock.firstElementChild;
      let blockType = blockElement.getAttribute("type")
      let value = blockElement.textContent

      if (blockType === "ast_UnaryOpUSub") {
        value = "-" + value
      } else if (blockType === "ast_Str" || blockType === "ast_StrChar") {
        value = "'" + value.replace("'", "\'").replace('\n', '\\n') + "'"
      }

      return this.#matchesDefaultValue(blockType, value)
    } else {
      // Blockly block
      return this.#matchesDefaultValue(argBlock.type, python.pythonGenerator.blockToCode(argBlock)[0])
    }
  }

  applyShadow(argBlock) {
    if (argBlock) {
      let shouldShadow = this.#shouldShadow(argBlock)

      if (argBlock instanceof HTMLElement) {
        // Blockly XML
        for (let childElement of [...argBlock.getElementsByTagName(shouldShadow ? 'block' : 'shadow')].reverse()) {
          this.#replaceTagName(childElement, shouldShadow ? 'shadow' : 'block')
        }
      } else if (argBlock.shadow !== shouldShadow) {
        // Blockly block
        argBlock.shadow = shouldShadow
        argBlock.setStyle(argBlock.getStyleName()) // Re-apply the style

        for (let child of argBlock.getChildren()) {
          argBlock.shadow = shouldShadow
          argBlock.setStyle(argBlock.getStyleName()) // Re-apply the style
        }
      }
    }
  }
}

class PythonParameters extends Array {
  constructor(signature, comment) {
    super();
    const parameters = signature
      .substring(signature.lastIndexOf("(") + 1, signature.lastIndexOf(")"))
      .trim();

    if (parameters !== "") {
      const args = comment.substring(
        comment.lastIndexOf("(") + 1,
        comment.lastIndexOf(")"),
      );
      const argParts = args.split(/(?<!\[[^\]]*),/).map((value) => {
        return value.trim();
      });
      const parameterParts = parameters.split(/(?<!\[[^\]]*),/).map((value) => {
        return value.trim();
      });

      // PEP 570 Python Positional-Only Parameters
      let positional = true;
      let keyword = !parameterParts.includes("/");
      let argIndex = 0;

      for (const parameter of parameterParts) {
        if (parameter === "/") {
          keyword = true;
        } else if (parameter === "*") {
          positional = false;
        } else {
          let isSelfOrCls = argIndex === 0 && (parameter === "self" || parameter === "cls")
          this.push(
            new PythonParameter(
              parameter,
          isSelfOrCls ? "" : (argParts[argIndex] ?? ""),
              positional,
              keyword,
            ),
          );

          if (!isSelfOrCls) {
            argIndex++;
          }
        }
      }

      // Any parameter before *args should not be addressable by keyword
      let positionalOnly = false

      for (let i = this.length - 1; i >= 0; i--) {
        let parameter = this[i]

        if (positionalOnly) {
          parameter.keyword = false
        }

        positionalOnly = positionalOnly || (parameter.variableLength && parameter.positional)
      }
    }
  }

  toPythonSource() {
    return [
      ...this.entries()
        .filter(([key, value]) => !(key === 0 && (value.name === "self" || value.name === "cls")))
        .map(([, value]) => value.toPythonSource()),
    ]
      .filter((result) => result !== "")
      .join(", ");
  }

  findByKeyword(keyword) {
    return this.values().find((value) => value.name === keyword);
  }
}

function splitPremessageMessage(toSplit) {
  let [premessage, message] = toSplit.trim().split("{}", 2);

  if (message === undefined) {
    return ["", premessage];
  }
  return [premessage, message];
}

function splitPremessageMessagePostmessage(toSplit) {
  let [premessage, message, postmessage] = toSplit.trim().split("{}", 3);

  if (message === undefined) {
    return ["", premessage, ""];
  } else if (postmessage === undefined) {
    return [premessage, message, ""];
  }
  return [premessage, message, postmessage];
}

class PythonFunction {
  static isA(signature) {
    return signature.includes("(");
  }

  constructor(pythonModule, signature, comment, colour) {
    this.pythonModule = pythonModule;
    let indexOfTypeHint = signature.indexOf(":", signature.indexOf(")") + 1);
    this.typeHint =
      indexOfTypeHint < 0
        ? ""
        : signature.substring(indexOfTypeHint + 1).trim();
    let names = signature.substring(0, signature.indexOf("("));
    const [name, ...aliases] = names.split(" ");
    this.name = name;

    if ((comment ?? "").trim() === "") {
      this.premessage = "";
      this.message = this.name;
    } else {
      let indexOfOpening = comment.indexOf("(");
      let beforeOpening =
          indexOfOpening === -1 ? comment : comment.substring(0, indexOfOpening);
      [this.premessage, this.message] = splitPremessageMessage(beforeOpening);
    }

    this.parameters = new PythonParameters(signature, comment ?? "");
    this.fullName = pythonModule.fullName === "" ? this.name : pythonModule.fullName + "." + this.name;
    this.isAlias = false;

      this.aliases = aliases.map((value) => {
      // Should be better, but does not seem to preserve methods in the current toolchain:
      // let result = structuredClone(this)
      // result.name = value
      let result = new PythonFunction(
        pythonModule,
        value + signature.substring(signature.indexOf("(")),
        comment,
      );
      result.isAlias = true;

      return result;
    });

    this.colour = colour ?? pythonModule.library.colour;
    this.argumentOffset = 0
  }

  toPythonSource() {
    let modulePrefix =
      this.pythonModule.fullName === "" ? "" : this.pythonModule.name + ".";
    return (
      modulePrefix +
      this.name +
      "(" +
      this.parameters.toPythonSource() +
      ")"
    );
  }

  toString() {
    return this.toPythonSource();
  }

  #replaceTagName(element, tagName) {
    let replacementElement = document.createElement(tagName);

    for (let i = 0, l = element.attributes.length; i < l; ++i) {
      let nodeName = element.attributes.item(i).nodeName;
      let nodeValue = element.attributes.item(i).nodeValue;
      replacementElement.setAttribute(nodeName, nodeValue);
    }

    replacementElement.innerHTML = element.innerHTML;
    element.parentNode.replaceChild(replacementElement, element);
  }

  applyShadow(block) {
    if (block instanceof HTMLElement) {
      let mutationElement = block.firstElementChild
      let i = 0
      let blockChildren = block.children

      for (let i = 0; i < mutationElement.children.length; i++) {
        let valueElement = blockChildren['ARG' + i]

        if (!valueElement) {
          continue
        }

        let mutation = mutationElement.children[i].getAttribute('name')

        if (mutation.startsWith('KEYWORD:')) {
          this.parameters.findByKeyword(mutation.substring(8))?.applyShadow(valueElement);
        } else {
          this.parameters[i + this.argumentOffset]?.applyShadow(valueElement);
        }
      }
    } else {
      for (let i = 0; i < block.arguments_.length; i++) {
        let mutation = block.arguments_[i]
        let argBlock = block.getInputTargetBlock('ARG' + i);

        if (mutation.startsWith('KEYWORD:')) {
          this.parameters.findByKeyword(mutation.substring(8))?.applyShadow(argBlock);
        } else {
          this.parameters[i + this.argumentOffset]?.applyShadow(argBlock);
        }
      }
    }
  }

  toToolboxBlock(textToBlocks) {
    let pythonSource = this.toPythonSource();
    let result = textToBlocks.convertSource("toolbox.py", pythonSource);
    let blockElement = result.rawXml.children[0];

    // if (!!this.typeHint) {
    //   blockElement.setAttribute("returns", this.typeHint);
    // }
    //
    // // TODO tooltip does not seem to show up
    // blockElement.setAttribute("tooltip", pythonSource);
    return blockElement;
  }

  toToolbox(textToBlocks) {
    if (this.isAlias) {
      return "";
    }

    let toolboxBlock = this.toToolboxBlock(textToBlocks)
    this.applyShadow(toolboxBlock)

    return (
        toolboxBlock.parentNode.innerHTML.toString() + "\n"
    );
  }
}

class PythonClass {
  static isA(signature) {
    return signature.startsWith("class ");
  }

  addMember(signature, inputObject) {
    let member;
    const [code, comment] = signature.split("//", 2);

    if (PythonFunction.isA(code)) {
      if (PythonConstructorMethod.isA(code)) {
        member = new PythonConstructorMethod(
            this,
            code,
            comment,
            inputObject?.colour ?? inputObject?.color,
        );
        this.colour = member.colour;
      } else {
        member = new PythonMethod(
            this,
            code,
            comment,
            inputObject?.colour ?? inputObject?.color,
        );

        for (let alias of member.aliases) {
          this.members.set(alias.name, alias);
        }
      }
    } else {
      member = new PythonAttribute(
          this,
          code,
          comment,
          inputObject?.colour ?? inputObject?.color,
      );
    }

    this.members.set(member.name, member);
  }

  constructor(pythonModule, signature, comment, members) {
    this.module = pythonModule;
    let endOfSimpleName = signature.indexOf("(")

    if (endOfSimpleName === -1) {
      endOfSimpleName = signature.length
      this.baseClass = "object"
    } else {
      this.baseClass = signature.substring(endOfSimpleName + 1, signature.indexOf(")")).trim()
    }

    let startOfSimpleName = signature.lastIndexOf(".", endOfSimpleName) + 1

    if (startOfSimpleName === 0 && signature.startsWith("class ")) {
      startOfSimpleName = 6
    }

    this.name = signature.substring(startOfSimpleName, endOfSimpleName);

    if (this.name === this.baseClass) {
      this.baseClass = ""
    }

    if (pythonModule.fullName === "") {
      this.fullName = this.name;
      this.requiresImport = "";
    } else {
      this.fullName = pythonModule.fullName + "." + this.name;
      this.requiresImport = this.fullName == this.name ? this.name: this.fullName + " as " + this.name;
    }

    this.colour = pythonModule.library.colour;
    this.members = new Map();

    // Default constructor
    this.members.set("__init__", new PythonConstructorMethod(
        this,
        "__init__()",
        "",
        null,
    ));

    for (let input of members) {
      if (typeof input === "object") {
        if (input.signatures) {
          for (const signature of input.signatures) {
            this.addMember(signature, input)
          }
        } else {
          this.addMember(input.signature, input)
        }
      } else {
        this.addMember(input)
      }
    }
  }

  toString() {
    return this.requiresImport;
  }

  toToolbox(textToBlocks) {
    let result = "";

    let originalImports = textToBlocks.imports
    try {
      textToBlocks.imports = new TypeRegistry()
      textToBlocks.imports.set(this.fullName, this.name)

      for (const member of this.members.values()) {
        result += member.toToolbox(textToBlocks);
      }
    } finally {
      textToBlocks.imports = originalImports
    }

    return result;
  }

  resolve(name) {
    if (name === this.fullName || name === this.name) {
      return this;
    }

    let memberName;

    if (name.startsWith(this.fullName + ".")) {
      memberName = name.substring(this.fullName.length + 1);
    } else if (name.startsWith(this.name + ".")) {
      memberName = name.substring(this.name.length + 1);
    } else {
      memberName = name;
    }

    let indexOfDot = memberName.indexOf("(");
    let result = this.members.get(
      indexOfDot === -1 ? memberName : memberName.substring(0, indexOfDot)
    );

    if (!result && this.baseClass !== "") {
      result = this.module.library.libraries.resolve(this.baseClass + "." + memberName);
    }

    return result
  }
}

class PythonAttribute {
  static isA(signature) {
    return !signature.includes("(");
  }

  constructor(pythonClassOrModule, signature, comment, colour) {
    this.pythonClassOrModule = pythonClassOrModule;
    let indexOfTypeHint = signature.lastIndexOf(":");
    this.typeHint =
      indexOfTypeHint < 0
        ? ""
        : signature.substring(indexOfTypeHint + 1).trim();
    this.name = signature
      .substring(0, indexOfTypeHint || signature.length)
      .trim();
    this.colour = colour ?? pythonClassOrModule.colour;

    if ((comment ?? "").trim() === "") {
      if (pythonClassOrModule instanceof PythonClass) {
        this.premessage = pythonClassOrModule.name;
      } else {
        this.premessage = ""
      }
      this.message = "."
      this.postmessage = ""
    } else {
      [this.premessage, this.message, this.postmessage] = splitPremessageMessagePostmessage(comment);
    }
  }

  toPythonSource() {
    if (this.pythonClassOrModule instanceof PythonClass) {
      return python.pythonGenerator.blank + "." + this.name;
    }
    return this.pythonClassOrModule.name + "." + this.name;
  }

  toString() {
    return this.toPythonSource();
  }

  toToolboxBlock(textToBlocks) {
    let blockElement
    if (this.pythonClassOrModule instanceof PythonClass) {
      let originalVariables = textToBlocks.variables
      try {
        textToBlocks.variables = new TypesRegistry()
        textToBlocks.variables.add(this.pythonClassOrModule.fullName, python.pythonGenerator.blank)
        let result = textToBlocks.convertSource(
            "toolbox.py",
            this.toPythonSource(),
        );
        blockElement = result.rawXml.children[0];
      } finally {
        textToBlocks.variables = originalVariables
      }
    } else {
      let result = textToBlocks.convertSource(
          "toolbox.py",
          this.toPythonSource(),
      );
      blockElement = result.rawXml.children[0];
    }


    // for (let index = blockElement.children.length - 1; index >= 0; index--) {
    //   let child = blockElement.children[index];
    //
    //   if (child.localName === "value") {
    //     child.innerHTML = "";
    //     // TODO type check, but only possible with JSON, not XML
    //     // child.setAttribute("check", this.pythonClass.fullName)
    //   }
    // }

    if (!!this.typeHint) {
      blockElement.setAttribute("output", this.typeHint);
    }
    return blockElement;
  }

  toToolbox(textToBlocks) {
    return (
      this.toToolboxBlock(textToBlocks).parentNode.innerHTML.toString() + "\n"
    );
  }
}

class PythonMethod extends PythonFunction {
  constructor(pythonClass, signature, comment, colour) {
    super(pythonClass.module, signature, comment, colour);
    this.pythonClass = pythonClass;
    this.fullName = pythonClass.fullName + "." + this.name;

    if ((comment ?? "").trim() === "") {
      this.message = "." + this.name;
    }

    if (this.parameters.length == 0) {
      this.staticmethod = true
      this.classmethod = false
    } else if (this.parameters[0].name === 'self') {
      this.staticmethod = false
      this.classmethod = false
    } else if (this.parameters[0].name === 'cls') {
      this.staticmethod = false
      this.classmethod = true
    } else {
      this.staticmethod = true
      this.classmethod = false
    }

    if (this.premessage === "" && !(this.classmethod || this.staticmethod)) {
      this.premessage = pythonClass.name;
    }

    this.argumentOffset = this.staticmethod ? 0 : 1
  }

  toPythonSource() {
    if (this.staticmethod || this.classmethod) {
      return (
          this.pythonClass.fullName + "." +
          this.name +
          "(" +
          this.parameters.toPythonSource() +
          ")"
      );
    }
    return (
        python.pythonGenerator.blank +
        "." +
        this.name +
        "(" +
        this.parameters.toPythonSource() +
        ")"
    );
  }

  toToolboxBlock(textToBlocks) {
      let originalVariables = textToBlocks.variables
      let blockElement
      try {
        textToBlocks.variables = new TypesRegistry()
        textToBlocks.variables.add(this.pythonClass.fullName, python.pythonGenerator.blank)
        blockElement = super.toToolboxBlock(textToBlocks);
      } finally {
        textToBlocks.variables = originalVariables
      }

      // TODO this can probably eventually be done cleaner
      // if (!!this.pythonClass.requiresImport) {
      //   blockElement.children['FUNC'].setAttribute(
      //     "module",
      //     this.pythonClass.requiresImport,
      //   );
      // }

      return blockElement
    }
}

class PythonConstructorMethod extends PythonMethod {
  static isA(signature) {
    return /^__init__\(\s*self\s*[,)]\s*/.test(signature);
  }

  constructor(pythonClass, signature, comment, colour) {
    super(pythonClass, signature, comment, colour);
    this.typeHint = pythonClass.fullName;

    if ((comment ?? "").trim() === "") {
      this.message = this.pythonClass.name
    }
  }

  toPythonSource() {
    return (
      this.pythonClass.name +
      "(" +
      this.parameters.toPythonSource() +
      ")"
    );
  }
}

class Library {
  constructor(name, libraryConfiguration, libraries) {
    this.name = name;
    this.libraries = libraries;
    this.modules = new Map();
    this.colour = BlockMirrorTextToBlocks.COLOR.FUNCTIONS;
    this.toolbox = null;
    let classes = [];

    for (let classOrModuleDef in libraryConfiguration) {
      const [name, comment] = classOrModuleDef.split("//", 2);

      if (name.startsWith("__")) {
        // Library metadata
        if (name === "__colour" || name === "__color") {
          this.colour = libraryConfiguration[name];
        } else if (name === "__toolbox") {
          this.toolbox = libraryConfiguration[name];
        }
      } else if (PythonClass.isA(name)) {
        classes.push(classOrModuleDef);
      } else {
        let members = libraryConfiguration[classOrModuleDef]

        if (members.some(member => PythonConstructorMethod.isA(member))) {
          classes.push(classOrModuleDef);
        } else {
          let module = new PythonModule(
              this,
              name,
              comment,
              members,
          )
          this.modules.set(module.fullName, module);
        }
      }
    }

    for (let classDef of classes) {
      const [signature, comment] = classDef.split("//", 2);
      let moduleName = PythonModule.extractName(signature);
      let pythonModule = this.modules.get(moduleName);

      if (!pythonModule) {
        pythonModule = new PythonModule(this, moduleName);
        this.modules.set(moduleName, pythonModule);
      }

      let pythonClass = new PythonClass(
        pythonModule,
        signature,
        comment,
        libraryConfiguration[classDef],
      );
      pythonModule.members.set(pythonClass.name, pythonClass);
    }
  }

  _shouldShowToolbox(imports) {
    if (this.toolbox === false || this.toolbox === true) {
      return this.toolbox;
    }

    if (imports) {
      for (const importedType of imports.types()) {
        for (const module of this.modules.values()) {
          if (module.resolve(importedType) !== null) {
            return true;
          }
        }
      }

      return false;
    }

    return true;
  }

  toToolbox(textToBlocks) {
    if (!this._shouldShowToolbox(textToBlocks.imports)) {
      return "";
    }

    let categoryXml = `<category name="${this.name}">`; // TODO color

    for (const module of this.modules.values()) {
      categoryXml += module.toToolbox(textToBlocks);
    }

    categoryXml += "</category>";
    return categoryXml;
  }

  registerImports(typeRegistry) {
    for (const module of this.modules.values()) {
      if (module.fullName === "") {
        continue
      }

      module.registerImports(typeRegistry)
    }
  }
}

class Libraries extends Map {
  constructor(librariesConfiguration) {
    super()
    for (let name in librariesConfiguration) {
      this.set(name, new Library(name, librariesConfiguration[name], this))
    }
  }

  findModulesByName(moduleName) {
    return this.values()
      .map((library) => library.modules.get(moduleName))
      .filter((module) => module).toArray();
  }

  toToolbox(textToBlocks) {
    let result = "";
    for (const library of this.values()) {
      result += library.toToolbox(textToBlocks);
    }
    return result;
  }

  resolve(fullName) {
    let moduleName = PythonModule.extractName(fullName);
    let foundModules = this.findModulesByName(moduleName);

    if (!foundModules.length && moduleName.includes('.')) {
      // Last part may be an attribute
      foundModules = this.findModulesByName(moduleName.substring(0, moduleName.lastIndexOf('.')));
    }

    if (!foundModules.length) {
      // Might not contain a module name, check the built-ins
      foundModules = this.findModulesByName('');
    }

    for (let foundModule of foundModules) {
      let found = foundModule.resolve(fullName);

      if (found) {
        return found;
      }
    }

    return null;
  }

  registerImports(typeRegistry) {
    for (const library of this.values()) {
      library.registerImports(typeRegistry)
    }
  }
}

/**
 * Default collection of libraries for BlockMirror
 *
 * Library metadata is prefixed with __
 * Member signatures can be defined as strings or as JSON objects with additional metadata.
 *
 * {
 *     'libraryName': {
 *         __color: optional color code for this library,
 *         __toolbox: optional boolean to show or hide library in toolbox - defaults to dynamic based on imports
 *         'fully qualified module name': [
 *             'module member signature',
 *             {
 *                 signature: 'module member signature',
 *                 custom: optional custom block creation function,
 *                 color: optional color,
 *             },
 *             {
 *                 signatures: [
 *                   'module member signature',
 *                   ...
 *                 ],
 *                 custom: optional custom block creation function,
 *                 color: optional color,
 *             },
 *             ...
 *         ]
 *         'fully qualified class name': [
 *             'class member signature',
 *             {
 *                 signature: 'class member signature',
 *                 custom: optional custom block creation function,
 *                 color: optional color,
 *             },
 *             {
 *                signatures: [
 *                   'class member signature',
 *                   ...
 *                 ],
 *                 custom: optional custom block creation function,
 *                 color: optional color,
 *             },
 *             ...
 *         ],
 *         ...
 *     },
 *     ...
 * }
 */
// TODO argument keywords are not yet translated to a message
BlockMirror.LIBRARIES = {
  // TODO consistency of colors may be improved, backward compatible for now
  'builtin dict': {
    __colour: BlockMirrorTextToBlocks.COLOR.DICTIONARY,
    __toolbox: false,
    'class collections.abc.Mapping': [
      'get(self, key, default=None, /): Any',
      'items(self): Any',
      'keys(self): Any',
      'values(self): Any',
    ],
    'class collections.abc.MutableMapping(collections.abc.Mapping)': [
      'popitem(self): Any',
      'setdefault(self, key, default=None, /): Any'
    ],
    'class dict(collections.abc.MutableMapping)': [
      '__init__(self, mapping=None, /, **kwargs)', // TODO is this sufficiently accurate?
      'fromkeys(cls, iterable, value=None, /): dict'
    ]
  },
  'builtin file': {
    __colour: BlockMirrorTextToBlocks.COLOR.FILE,
    __toolbox: false,
    '': [
      'input(prompt: str | None = None): str', // TODO check category/color
      "open(file, mode='r', buffering=-1, encoding=None, errors=None, newline=None, closefd=True, opener=None): Any",
      "print(*objects, sep: str = ' ', end: str ='\\n', file=None, flush: bool = False)" // TODO check category/color
    ],
  },
  'builtin list': {
    __colour: BlockMirrorTextToBlocks.COLOR.LIST,
    __toolbox: false,
    'class collections.abc.Sequence': [
      'count(self, item, /): int',
      'index(self, item, /): int',
    ],
    'class collections.abc.MutableSequence(collections.abc.Sequence)': [
        'append(self, value): None // to list {} append (___)',
        'extend(self, other: collections.abc.Sequence, /): None',
        'insert(self, pos, elmnt, /): None // to list {} insert at (___, ___)',
        'reverse(self): collections.abc.MutableSequence'
    ],
    'class list(collections.abc.MutableSequence)': [
      '__init__(self, iterable = None, /)',
      'copy(self): list',
      'sort(self, *, reverse: bool = False, key = None)',
      {
        signatures: [
          'clear(self): None',
          'pop(self, pos: int | None = None, /): Any',
          'remove(self, value: Any): None'
        ],
        colour: BlockMirrorTextToBlocks.COLOR.SEQUENCES,
      },
    ]
  },
  'builtin math': {
    __colour: BlockMirrorTextToBlocks.COLOR.MATH,
    __toolbox: false,
    '': [
      'abs(x: Any, /): Any',
      'bin(x: Any, /): str',
      'hash(object, /): int',
      'hex(int, /): str',
      'min(iterable, *, key=None): Any', // TODO *args variant and default argument
      'max(iterable, *, key=None): Any', // TODO *args variant and default argument
      'oct(int, /): str',
      'pow(base, exp, mod=None): Any',
      'round(number: float | int, ndigits: int | None = None): float | int // round(___)',
      'sum(iterable, /, start: float | int = 0): float | int',
      'divmod(a: float | int, b: float | int): tuple[int, float]',
    ],
    'class numbers.Number': [],
    'class numbers.Complex(numbers.Number)': [
      'conjugate(self): numbers.Complex'
    ],
    'class numbers.Real(numbers.Complex)': [],
    'class numbers.Rational(numbers.Real)': [],
    'class numbers.Integral(numbers.Rational)': [],
    'class complex(numbers.Complex)': [
      '__init__(self, real=0, /, imag=0): ', // TODO would need support for multiple signatures to improve accuracy
    ],
    'class float(numbers.Real)': [
      '__init__(self, value: float | str = 0.0, /): None',
      'as_integer_ratio(self): tuple[int, int]',
      'fromhex(cls, string: str): float // fromhex(___)',
      'hex(): str',
      'is_integer(self): bool'
    ],
    'class int(numbers.Integral)': [
      '__init__(self, value: int | str = 0, /, base: int = 10): None',
      'as_integer_ratio(self): tuple[int, int]',
      'bit_length(self): int',
      'from_bytes(cls, bytes, byteorder: str = "big", *, signed: bool = False): int // from_bytes(___)',
      'to_bytes(self, length: int = 1, byteorder: str ="big", *, signed: bool = False): bytes',
        'is_integer(self): bool'
    ]
  },
  'builtin oo': {
    __colour: BlockMirrorTextToBlocks.COLOR.OO,
    __toolbox: false,
    '': [
      'callable(object: Any, /): bool',
      'classmethod(method, /): Any',
      'getattr(object, name: str): Any', // TODO support default parameter
      'hasattr(object, name: str, /): bool',
      'isinstance(object, classinfo, /): bool',
      'issubclass(object, classinfo, /): bool',
      'setattr(object, name, value, /): None', // TODO inconsistent with delattr color
      'staticmethod(method, /): Any',
      {
        signatures: ['all(iterable): bool', 'any(iterable): bool'],
        colour: BlockMirrorTextToBlocks.COLOR.LOGIC
      }
    ],
    'class bool': [
      {
        signature: '__init__(self, object: Any = False, /): None',
        colour: BlockMirrorTextToBlocks.COLOR.LOGIC
      }
    ],
    'class object': [
      {
        signatures: [
            '__enter__(self): Any',
            '__exit__(self, exc_type, exc_value, traceback): None',
        ],
        color: BlockMirrorTextToBlocks.COLOR.CONTROL,
      },
      {
        signature: '__iter__(self): iterator',
        color: BlockMirrorTextToBlocks.COLOR.SEQUENCES,
      },
      {
        signatures: [
          '__lt__(self, other): bool',
          '__le__(self, other): bool',
          '__eq__(self, other): bool',
          '__ne__(self, other): bool',
          '__gt__(self, other): bool',
          '__ge__(self, other): bool',
        ],
        color: BlockMirrorTextToBlocks.COLOR.LOGIC,
      }
    ],
    'class property': [
      '__init__(self, fget=None, fset=None, fdel=None, doc=None): None'
    ],
    'class super': [
      '__init__(self, type, object_or_type=None, /): None'
    ],
    'class type': [
      'mro(): Any',
      '__subclasses__(): None',
    ]
  },
  'builtin sequences': {
    __colour: BlockMirrorTextToBlocks.COLOR.SEQUENCES,
    __toolbox: false,
    '': [
      'enumerate(iterable, start: int = 0): iterator',
      'filter(function, iterable): iterator',
      'iter(object, sentinel = ___): iterator',
      'len(s): int',
      'map(function, iterable, *iterables): iterator',
      'next(iterator, default = ___): Any',
      'reversed(seq): iterator',
      'sorted(iterable, /, *, key = None, reverse: boolean = False): list',
      'zip(*iterables, strict: boolean = False): iterator',
    ],
    'class bytes': [
      {
        signatures: [
          '__init__(self, source, encoding = None, errors = None): None', // TODO not fully accurate
          'decode(encoding: str = "utf-8", errors: str = "strict"): str',
        ],
        colour: BlockMirrorTextToBlocks.COLOR.TEXT,
      },
      {
        signature: 'fromhex(cls, string: str, /): bytes',
        colour: BlockMirrorTextToBlocks.COLOR.MATH,
      },
    ],
    'class iterator': ['__next__(self): Any'],
    'class range': [
      '__init__(self, startOrStop: int, stop: int | None = None, step: int = 1, /): None',
    ],
    'class slice': [
      '__init__(self, startOrStop: int, stop: int | None = None, step:int | None = None, /): None',
    ],
  },
  'builtin set': {
    __colour: BlockMirrorTextToBlocks.COLOR.SET,
    __toolbox: false,
    'class collections.abc.Set(collections.abc.Collection)': [
      'isdisjoint(self, other, /): bool',
      'issubset(self, other, /): bool',
      'issuperset(self, other, /): bool',
    ],
    'class collections.abc.MutableSet(collections.abc.Set)': [
    ],
    'class set(collections.abc.MutableSet)': [
      '__init__(self, iterable = None, /): None',
      'add(self, elem, /): None',
      'difference(self, *others, /): set', // TODO handle *arg
      'difference_update(self, *others, /): None', // TODO handle *arg
      'discard(self, elem, /): None',
      'intersection(self, *others, /): set', // TODO handle *arg
      'intersection_update(self, *others, /): None', // TODO handle *arg
      'symmetric_difference(self, others, /): set',
      'symmetric_difference_update(self, others, /): None',
      'union(self, *others, /): set', // TODO handle *arg
      'update(self, *others, /): None', // TODO handle *arg
    ],
    'class frozenset(collections.abc.Set)': [
      {
        signature: '__init__(self, iterable = None, /): None',
        colour: BlockMirrorTextToBlocks.COLOR.SEQUENCES
      }
    ],
  },
  'builtin python': {
    __colour: BlockMirrorTextToBlocks.COLOR.PYTHON,
    __toolbox: false,
    '': [
      'breakpoint(*args, **kws): None',
      'compile(source, filename, mode, flags: int = 0, dont_inherit: bool = False, optimize: int = -1)',
      'dir(object = None): list',
      'eval(source, /, globals: dict | None = None, locals=None): Any',
      'exec(source, /, globals: dict | None = None, locals=None, *, closure=None): None',
      'help(request = None): Any',
      'id(object, /): int',
      '__import__(name, globals=None, locals=None, fromlist=(), level: int = 0)'
    ],
    'class memoryview': [
      '__init__(self, object): None',
      'tobytes(self, order: str = "C"): bytes',
      'tolist(self): list',
      'release(self): None',
      'cast(self, format: str, shape: list[int] | None = None, /): list',
    ]
  },
  'builtin text': {
    __colour: BlockMirrorTextToBlocks.COLOR.TEXT,
    __toolbox: false,
    '': [
      'ascii(object: Any, /): str',
      'chr(i: int, /): str',
      "format(value: Any, format_spec=''): Any",
      'ord(c: str, /): int',
      'repr(object: Any, /): str',
    ],
    'class bytearray': [
      '__init__(self, source = None, encoding = None, errors = None, /): None', // TODO not fully accurate
    ],
    'class str': [
      "__init__(self, object: str = '', encoding: str = 'utf-8', errors: str = 'strict'): None // str(___)",
      'capitalize(self): str',
      'casefold(self): str',
      'center(self, width: int, fillchar: str = " ", /): str',
      'count(self, sub, start: int | None = None, end: int | None = None, /): int',
      'encode(self, encoding: str = "utf-8", errors: str = "strict"): str',
      'endswith(self, suffix, start: int | None = None, end: int | None = None, /): bool',
      'expandtabs(self, tabsize: int = 8): self',
      'find(self, sub, start: int | None = None, end: int | None = None, /): int',
      'format(self, *args, **kwargs): str', // TODO handling of args and kwargs
      'format_map(self, mapping, /): str',
      'index(self, sub, start: int | None = None, end: int | None = None, /): int',
      'isalnum(self): bool',
      'isalpha(self): bool',
      'isdecimal(self): bool',
      'isdigit(self): bool',
      'isidentifier(self): bool',
      'islower(self): bool',
      'isnumeric(self): bool',
      'isprintable(self): bool',
      'isspace(self): bool',
      'istitle(self): bool',
      'isupper(self): bool',
      'join(self, iterable): str',
      'ljust(self, width: int, fillchar: str = " ", /): str',
      'lower(self): str',
      'lstrip(self, chars: str | None = None, /): str',
      'maketrans(self, x, y: str | None = None, z: str | None = None, /): str',
      'partition(self, sep: str, /): tuple[str, str, str]',
      'replace(self, old: str, new: str, count: int = -1, /): str',
      'rfind(self, sub, start: int | None = None, end: int | None = None, /): int',
      'rindex(self, sub, start: int | None = None, end: int | None = None, /): int',
      'rjust(self, width: int, fillchar: str = " ", /): str',
      'rpartition(self, sep: str, /): tuple[str, str, str]',
      'rsplit(self, sep: str | None = None, maxsplit: int = -1): list[str]',
      'rstrip(self, chars: str | None = None): str',
      'split(self, sep: str | None = None, maxsplit: int = -1): list[str]',
      'splitlines(self, keepends: bool = False): list[str]',
      'startswith(self, prefix, start: int | None = None, end: int | None = None, /): bool',
      'strip(self, chars: str | None = None): str',
      'swapcase(self): str',
      'title(self): str',
      'translate(self, table): str',
      'upper(self): str',
      'zfill(self, width: int): str',
    ]
  },
  'builtin tuple': {
    __colour: BlockMirrorTextToBlocks.COLOR.TUPLE,
    __toolbox: false,
    'class tuple': [
      '__init__(self, iterable = None, /): None',
    ],
  },
  'builtin variables': {
    __colour: BlockMirrorTextToBlocks.COLOR.VARIABLES,
    __toolbox: false,
    '': [
      'delattr(object, name: str, /): None',
      'globals(): dict',
      'locals(): dict',
      'vars(object = None, /): dict',
    ],
  },
  cisc108: {
    __colour: BlockMirrorTextToBlocks.COLOR.PYTHON,
    __toolbox: false,
    'cisc108': [
        'assert_equal(x: Any, y: Any, precision: int = 4, exact_strings: bool = False, *args): bool', // TODO support *args
    ]
  },
  image: {
    __toolbox: false,
    'class Image': [
      {
        signature: '__init__(self, src: str, /): None',
        custom: BlockMirrorTextToBlocks.ast_Image
      }
    ]
  },
  matplotlib: {
    __toolbox: false,
    __colour: BlockMirrorTextToBlocks.COLOR.PLOTTING,
    'matplotlib.pyplot as plt': [
        'show(*, block: bool | None = None): None // show plot canvas',
        "hist(x, bins=None, *, range=None, density=False, weights=None, cumulative: bool = False, bottom=None, histtype: str = 'bar', align: str = 'mid', orientation: str = 'vertical', rwidth: float | None = None, log: bool = False, color=None, label=None, stacked: bool = False, data=None, **kwargs): Any // plot histogram",
        "bar(x, height, width=0.8, bottom=None, *, align: str = 'center', data=None, tick_label = None, **kwargs): Any // plot bar chart", // tick_label added explicitly
        "plot(*args, scalex: bool = True, scaley: bool = True, data=None, **kwargs): list // plot line",
        "boxplot(x, *, notch=None, sym=None, vert=None, orientation='vertical', whis=None, positions=None, widths=None, patch_artist=None, bootstrap=None, usermedians=None, conf_intervals=None, meanline=None, showmeans=None, showcaps=None, showbox=None, showfliers=None, boxprops=None, tick_labels=None, flierprops=None, medianprops=None, meanprops=None, capprops=None, whiskerprops=None, manage_ticks=True, autorange=False, zorder=None, capwidths=None, label=None, data=None): dict // plot boxplot",
        "hlines(y, xmin, xmax, colors=None, linestyles='solid', *, label='', data=None, **kwargs): Any // plot horizontal line",
        "vlines(x, ymin, ymax, colors=None, linestyles='solid', *, label='', data=None, **kwargs): Any // plot vertical line",
        "scatter(x, y, s=None, c=None, *, marker=None, cmap=None, norm=None, vmin=None, vmax=None, alpha=None, linewidths=None, edgecolors=None, colorizer=None, plotnonfinite=False, data=None, **kwargs) // plot scatter",
        "title(label: str, fontdict=None, loc=None, pad=None, *, y=None, **kwargs): Any // make plot's title",
        "xlabel(xlabel: str, fontdict=None, labelpad=None, *, loc=None, **kwargs): None // make plot's x-axis label",
        "ylabel(ylabel, fontdict=None, labelpad=None, *, loc=None, **kwargs) // make plot's y-axis label",
        'xticks(ticks=None, labels=None, *, minor=False, **kwargs) // make x ticks',
        'yticks(ticks=None, labels=None, *, minor=False, **kwargs) // make y ticks'
    ]
  },
  turtle: {
    __colour: BlockMirrorTextToBlocks.COLOR.PLOTTING,
    turtle: [
      {
        signature: 'forward fd(amount: float): None // move turtle forward by(50)',
        colour: BlockMirrorTextToBlocks.COLOR.LOGIC
      },
      'backward bd(amount: float): None // move turtle backward by(50)',
      'right rt(angle: float): None // turn turtle right by(90)',
      'left lt(angle: float): None // turn turtle left by(90)',
      'goto setpos setposition(x: float, y: float): None // move turtle to position(0, 0)',
      "setx(x: float): None // set turtle's x position to(100)",
      "sety(y: float): None // set turtle's y position to(100)",
      "setheading seth(angle: float): None // set turtle's heading to(270)",
      'home(): None // move turtle to origin',
      'circle(radius: float): None // move the turtle in a circle',
      'dot(size: float, color: Any): None // turtle draws a dot(0, )',
      'stamp(): Any // stamp a copy of the turtle shape()',
      'clearstamp(stampid: Any): None // delete stamp with id',
      'clearstamps(): None // delete all stamps',
      'undo(): None // undo last turtle action',
      'speed(speed: int | None = None): int | None // set or get turtle speed()',
      "position pos(): (float, float) // get turtle's position",
      'towards(x: float, y: float): float // get the angle from the turtle to the point',
      "xcor(): float // get turtle's x position",
      "ycor(): float // get turtle's y position",
      "heading(): float // get turtle's heading",
      "distance(x: float, y: float): float // get the distance from turtle's position to()",
      'degrees(): None // set turtle mode to degrees',
      'radians(): None // set turtle mode to radians',
      'pendown pd down(): None // pull turtle pen down',
      'penup pu up(): None // pull turtle pen up',
      // Skipped some
      'pensize(width: float | None = None): float | None // set or get the pen size()',
      // Skipped some
      'pensize(width: float | None = None): float | None // set or get the pen size()',
      "pencolor(color: tuple[float, float, float] | str | None = None): tuple[float, float, float] | None // set or get the pen color('blue')",
      "fillcolor(color: tuple[float, float, float] | str | None = None): tuple[float, float, float] | None // set or get the fill color('yellow')",
      'reset(): None // reset drawing',
      'clear(): None // clear drawing',
      'write(message: str): None // write text',
      // Skipped some
      'bgpic(url: str): None // set background to',
      'done mainloop(): None // start the turtle loop',
      'setup(width: float, height: float): None // set drawing area size',
      'title(message: str): None // set title of drawing area',
      'bye(): None // say goodbye to turtles',
    ],
  },
};
