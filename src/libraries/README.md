# BlockMirror libraries

The .json files under the libraries directory describe the default collection of libraries for BlockMirror.

## Structure

Library metadata is prefixed with __.

Member signatures can be defined as strings or as JSON objects with additional metadata.

Below is the annotated structure of a library. 

    {
        "libraryName": {
            "__color": optional color for this library - a string referencing a member of BlockMirrorTextToBlocks.COLOR,
            "__toolbox": optional boolean to show or hide library in toolbox - defaults to dynamic based on imports
            "fully qualified module name": [
                "module member signature",
                {
                    "signature": "module member signature",
                    "custom": optional custom block creation function,
                    "color": optional color,
                },
                {
                    "signatures": [
                      "module member signature",
                      ...
                    ],
                    "custom": optional custom block creation function (as a string),
                    "color": optional color,
                },
                ...
            ]
            "fully qualified class name": [
                "class member signature",
                {
                    "signature": "class member signature",
                    "custom": optional custom block creation function (as a string),
                    "color": optional color,
                },
                {
                   "signatures": [
                      "class member signature",
                      ...
                    ],
                    "custom": optional custom block creation function (as a string),
                    "color": optional color,
                },
                ...
            ],
            ...
        },
        ...
    }


## Aliases

Aliases can be indicated by adding multiple space separated names.

Aliases may be used for:
- explicitly added function and method aliases (not considered very 'pythonic' but used in various libraries, such as Turtle)
- class or module attributes, belonging to the same Enum class or otherwise similar and related
- mutually exclusive keyword arguments

Aliases only indicate a logical relation, runtime behavior may or may not differ, depending on the implementation.

## Implementation notes

- `matplotlib.pyplot.bar`: tick_label argument added explicitly.

## TODO

- Consistency of colors may be improved. Backward compatible for now.
- Argument keywords are not yet translated to a message.

### builtin/dict.json

- `dict.__init__`: Is this sufficiently accurate?

### builtin/file.json

- `input`: Check category/color.
- `print`: Check category/color.

### builtin/math.json
 
- `bytes.__init__`: Not fully accurate.
- `complex.__init__`: Would need support for multiple signatures to improve accuracy.
- `min`: *args variant and default argument.
- `max`: *args variant and default argument.

### builtin/oo.json

- `getattr`: Support default parameter.
- `setattr`: Is inconsistent with delattr color.

### builtin/set.json
- `difference`: Needs to handle *arg.
- `difference_update`: Needs to handle *arg.
- `intersection`: Needs to handle *arg.
- `intersection_update`: Needs to handle *arg.
- `union`: Needs to handle *arg.
- `update`: Needs to handle *arg.

### builtin/text.json

- `bytearray.__init__`: Not fully accurate.
- `str.format`: Handling of args and kwargs.

### cisc108

- `assert_equal`: Support *args.

### turtle

- `towards`: Support a pair/vector.
- `distance`: Support a pair/vector.
- Tuples cannot yet be passed as individual arguments instead.
- Skipped some: pen, color, Filling, Visibility, Appearance and most that come after this
- `setup`: Support startx, starty arguments.

