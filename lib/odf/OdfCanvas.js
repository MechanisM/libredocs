/**
 * Copyright (C) 2011 KO GmbH <jos.van.den.oever@kogmbh.com>
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/odfkit/webodf/
 */
/*jslint sub: true*/
/*global runtime, odf, xmldom */
runtime.loadClass("odf.OdfContainer");
runtime.loadClass("odf.Formatting");
runtime.loadClass("xmldom.XPath");
/**
 * This class manages a loaded ODF document that is shown in an element.
 * It takes care of giving visual feedback on loading, ensures that the
 * stylesheets are loaded.
 * @constructor
 * @param {!Element} element Put and ODF Canvas inside this element.
 **/
odf.OdfCanvas = (function () {
    "use strict";
    /**
     * Register event listener on DOM element.
     * @param {!Element} eventTarget
     * @param {!string} eventType
     * @param {!Function} eventHandler
     * @return {undefined}
     */
    function listenEvent(eventTarget, eventType, eventHandler) {
        if (eventTarget.addEventListener) {
            eventTarget.addEventListener(eventType, eventHandler, false);
        } else if (eventTarget.attachEvent) {
            eventType = "on" + eventType;
            eventTarget.attachEvent(eventType, eventHandler);
        } else {
            eventTarget["on" + eventType] = eventHandler;
        }
    }
    /**
     * Class that listens to events and sends a signal if the selection changes.
     * @constructor
     * @param {!Element} element
     */
    function SelectionWatcher(element) {
        var selection = [], count = 0, listeners = [];
        /**
         * @param {!Element} ancestor
         * @param {Node} descendant
         * @return {!boolean}
         */
        function isAncestorOf(ancestor, descendant) {
            while (descendant) {
                if (descendant === ancestor) {
                    return true;
                }
                descendant = descendant.parentNode;
            }
            return false;
        }
        /**
         * @param {!Element} element
         * @param {!Range} range
         * @return {!boolean}
         */
        function fallsWithin(element, range) {
            return isAncestorOf(element, range.startContainer) &&
                isAncestorOf(element, range.endContainer);
        }
        /**
         * @return {!Array.<!Range>}
         */
        function getCurrentSelection() {
            var s = [], selection = runtime.getWindow().getSelection(), i, r;
            for (i = 0; i < selection.rangeCount; i += 1) {
                r = selection.getRangeAt(i);
                // check if the nodes in the range fall completely within the
                // element
                if (r !== null && fallsWithin(element, r)) {
                    s.push(r);
                }
            }
            return s;
        }
        /**
         * @param {Range} rangeA
         * @param {Range} rangeB
         * @return {!boolean}
         */
        function rangesNotEqual(rangeA, rangeB) {
            if (rangeA === rangeB) {
                return false;
            }
            if (rangeA === null || rangeB === null) {
                return true;
            }
            return rangeA.startContainer !== rangeB.startContainer ||
                   rangeA.startOffset !== rangeB.startOffset ||
                   rangeA.endContainer !== rangeB.endContainer ||
                   rangeA.endOffset !== rangeB.endOffset;
        }
        /**
         * @return {undefined}
         */
        function emitNewSelection() {
            var i, l = listeners.length;
            for (i = 0; i < l; i += 1) {
                listeners[i](element, selection);
            }
        }
        /**
         * @param {!Array.<!Range>} selection
         * @return {!Array.<!Range>}
         */
        function copySelection(selection) {
            var s = new Array(selection.length), i, oldr, r,
                doc = element.ownerDocument;
            for (i = 0; i < selection.length; i += 1) {
                oldr = selection[i];
                r = doc.createRange();
                r.setStart(oldr.startContainer, oldr.startOffset);
                r.setEnd(oldr.endContainer, oldr.endOffset);
                s[i] = r;
            }
            return s;
        }
        /**
         * @return {undefined}
         */
        function checkSelection() {
            var s = getCurrentSelection(), i;
            if (s.length === selection.length) {
                for (i = 0; i < s.length; i += 1) {
                    if (rangesNotEqual(s[i], selection[i])) {
                        break;
                    }
                }
                if (i === s.length) {
                    return; // no change
                }
            }
            selection = s;
            selection = copySelection(s);
            emitNewSelection();
        }
        /**
         * @param {!string} eventName
         * @param {!function(!Element, !Array.<!Range>)} handler
         * @return {undefined}
         */
        this.addListener = function (eventName, handler) {
            var i, l = listeners.length;
            for (i = 0; i < l; i += 1) {
                if (listeners[i] === handler) {
                    return;
                }
            }
            listeners.push(handler);
        };
        listenEvent(element, "mouseup", checkSelection);
        listenEvent(element, "keyup", checkSelection);
        listenEvent(element, "keydown", checkSelection);
    }
    var style2CSS = new odf.Style2CSS(),
        namespaces = style2CSS.namespaces,
        drawns  = namespaces.draw,
        fons    = namespaces.fo,
        officens = namespaces.office,
        svgns   = namespaces.svg,
        textns  = namespaces.text,
        xlinkns = namespaces.xlink,
        window = runtime.getWindow(),
        xpath = new xmldom.XPath(),
        /**@const@type{!Object.<!string,!Array.<!Function>>}*/ eventHandlers = {},
        editparagraph;

    /**
     * Register an event handler
     * @param {!string} eventType
     * @param {!Function} eventHandler
     * @return {undefined}
     */
    function addEventListener(eventType, eventHandler) {
        var handlers = eventHandlers[eventType];
        if (handlers === undefined) {
            handlers = eventHandlers[eventType] = [];
        }
        if (eventHandler && handlers.indexOf(eventHandler) === -1) {
            handlers.push(eventHandler);
        }
    }
    /**
     * Fire an event
     * @param {!string} eventType
     * @param {Array.<Object>=} args
     * @return {undefined}
     */
    function fireEvent(eventType, args) {
        if (!eventHandlers.hasOwnProperty(eventType)) {
            return;
        }
        var handlers = eventHandlers[eventType], i;
        for (i = 0; i < handlers.length; i += 1) {
            handlers[i](args);
        }
    }
    /**
     * @param {!Element} element
     * @return {undefined}
     */
    function clear(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
    /**
     * A new styles.xml has been loaded. Update the live document with it.
     * @param {!Element} odfelement
     * @param {!HTMLStyleElement} stylesxmlcss
     * @return {undefined}
     **/
    function handleStyles(odfelement, stylesxmlcss) {
        // update the css translation of the styles    
        var style2css = new odf.Style2CSS();
        style2css.style2css(stylesxmlcss.sheet, odfelement.styles,
                    odfelement.automaticStyles);
    }
    /**
     * @param {!string} id
     * @param {!Element} frame
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function setFramePosition(id, frame, stylesheet) {
        frame.setAttribute('styleid', id);
        var rule,
            anchor = frame.getAttributeNS(textns, 'anchor-type'),
            x = frame.getAttributeNS(svgns, 'x'),
            y = frame.getAttributeNS(svgns, 'y'),
            width = frame.getAttributeNS(svgns, 'width'),
            height = frame.getAttributeNS(svgns, 'height'),
            minheight = frame.getAttributeNS(fons, 'min-height'),
            minwidth = frame.getAttributeNS(fons, 'min-width');
        if (anchor === "as-char") {
            rule = 'display: inline-block;';
        } else if (anchor || x || y) {
            rule = 'position: absolute;';
        } else if (width || height || minheight || minwidth) {
            rule = 'display: block;';
        }
        if (x) {
            rule += 'left: ' + x + ';';
        }
        if (y) {
            rule += 'top: ' + y + ';';
        }
        if (width) {
            rule += 'width: ' + width + ';';
        }
        if (height) {
            rule += 'height: ' + height + ';';
        }
        if (minheight) {
            rule += 'min-height: ' + minheight + ';';
        }
        if (minwidth) {
            rule += 'min-width: ' + minwidth + ';';
        }
        if (rule) {
            rule = 'draw|' + frame.localName + '[styleid="' + id + '"] {' +
                rule + '}';
            stylesheet.insertRule(rule, stylesheet.cssRules.length);
        }
    }
    /**
     * @param {!Element} image
     * @return {string}
     **/
    function getUrlFromBinaryDataElement(image) {
        var node = image.firstChild;
        while (node) {
            if (node.namespaceURI === officens &&
                    node.localName === "binary-data") {
                // TODO: detect mime-type, assuming png for now
                return "data:image/png;base64," + node.textContent;
            }
            node = node.nextSibling;
        }
        return "";
    }
    /**
     * @param {!string} id
     * @param {!Object} container
     * @param {!Element} image
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function setImage(id, container, image, stylesheet) {
        image.setAttribute('styleid', id);
        var url = image.getAttributeNS(xlinkns, 'href'),
            part,
            node;
        function callback(url) {
            var rule = "background-image: url(" + url + ");";
            rule = 'draw|image[styleid="' + id + '"] {' + rule + '}';
            stylesheet.insertRule(rule, stylesheet.cssRules.length);
        }
        // look for a office:binary-data
        if (url) {
            try {
                if (container.getPartUrl) {
                    url = container.getPartUrl(url);
                    callback(url);
                } else {
                    part = container.getPart(url);
                    part.onchange = function (part) {
                        callback(part.url);
                    };
                    part.load();
                }
            } catch (e) {
                runtime.log('slight problem: ' + e);
            }
        } else {
            url = getUrlFromBinaryDataElement(image);
            callback(url);
        }
    }
    function formatParagraphAnchors(odfbody) {
        var runtimens = "urn:webodf",
            n, i,
            nodes = xpath.getODFElementsWithXPath(odfbody,
                ".//*[*[@text:anchor-type='paragraph']]",
                style2CSS.namespaceResolver);
        for (i = 0; i < nodes.length; i += 1) {
             n = nodes[i];
             if (n.setAttributeNS) {
                 n.setAttributeNS(runtimens, "containsparagraphanchor", true);
             }
        }
    }
    /**
     * @param {!Object} container
     * @param {!Element} odfbody
     * @param {!StyleSheet} stylesheet
     * @return {undefined}
     **/
    function modifyImages(container, odfbody, stylesheet) {
        var node,
            frames,
            i,
            images;
        function namespaceResolver(prefix) {
            return namespaces[prefix];
        }
        frames = [];
        node = odfbody.firstChild;
        while (node && node !== odfbody) {
            if (node.namespaceURI === drawns) {
                frames[frames.length] = node;
            }
            if (node.firstChild) {
                node = node.firstChild;
            } else {
                while (node && node !== odfbody && !node.nextSibling) {
                    node = node.parentNode;
                }
                if (node && node.nextSibling) {
                    node = node.nextSibling;
                }
            }
        }
        for (i = 0; i < frames.length; i += 1) {
            node = frames[i];
            setFramePosition('frame' + String(i), node, stylesheet);
        }
        images = odfbody.getElementsByTagNameNS(drawns, 'image');
        for (i = 0; i < images.length; i += 1) {
            node = /**@type{!Element}*/(images.item(i));
            setImage('image' + String(i), container, node, stylesheet);
        }
        formatParagraphAnchors(odfbody);
    }
    /**
     * @param {Document} document Put and ODF Canvas inside this element.
     */
    function addStyleSheet(document) {
        var styles = document.getElementsByTagName("style"),
            head = document.getElementsByTagName('head')[0],
            text = '', prefix, a = "", b;
        // use cloneNode on an exisiting HTMLStyleElement, because in
        // Chromium 12, document.createElement('style') does not give a
        // HTMLStyleElement
        if (styles && styles.length > 0) {
            styles = styles[0].cloneNode(false);
        } else {
            styles = document.createElement('style');
        }
        for (prefix in namespaces) {
            if (namespaces.hasOwnProperty(prefix) && prefix) {
                text += "@namespace " + prefix + " url(" + namespaces[prefix] +
                        ");\n";
            }
        }
        styles.appendChild(document.createTextNode(text));
        head.appendChild(styles);
        return styles;
    }
    /**
     * @constructor
     * @param {!Element} element Put and ODF Canvas inside this element.
     */
    odf.OdfCanvas = function OdfCanvas(element) {
        var self = this,
            document = element.ownerDocument,
            /**@type{odf.OdfContainer}*/ odfcontainer,
            /**@type{!odf.Formatting}*/ formatting = new odf.Formatting(),
            selectionWatcher = new SelectionWatcher(element),
            slidecssindex = 0,
            slidevisibilitycss = addStyleSheet(document),
            stylesxmlcss = addStyleSheet(document),
            positioncss = addStyleSheet(document),
            editable = false;

        /**
         * A new content.xml has been loaded. Update the live document with it.
         * @param {!Object} container
         * @param {!Element} odfnode
         * @return {undefined}
         **/
        function handleContent(container, odfnode) {
            var css = positioncss.sheet;
            modifyImages(container, odfnode.body, css);
            slidecssindex = css.insertRule(
                'office|presentation draw|page:nth-child(1n) { display:block; }',
                css.cssRules.length);

            // FIXME: this is a hack to have a defined background now
            // should be removed as soon as we have sane background
            // handling for pages
            slidecssindex = css.insertRule(
                'draw|page { background-color:#fff; }',
                css.cssRules.length);


            // only append the content at the end
            clear(element);
            element.appendChild(odfnode);
        }
        /**
         * @param {!odf.OdfContainer} container
         * @return {undefined}
         **/
        function refreshOdf(container) {
            if (odfcontainer !== container) {
                return;
            }

            // synchronize the object a window.odfcontainer with the view
            function callback() {
                clear(element);
                element.style.display = "inline-block";
                element.style.background = "white";
                var odfnode = container.rootElement;
                element.ownerDocument.importNode(odfnode, true);

                formatting.setOdfContainer(container);
                handleStyles(odfnode, stylesxmlcss);
                // do content last, because otherwise the document is constantly
                // updated whenever the css changes
                handleContent(container, odfnode);
                fireEvent("statereadychange");
            }

            if (odfcontainer.state === odf.OdfContainer.DONE) {
                callback();
            } else {
                odfcontainer.onchange = callback;
            }
        }

        this.odfContainer = function () {
            return odfcontainer;
        };

        this.slidevisibilitycss = function() {
            return slidevisibilitycss;
        };

        /**
         * @param {!string} url
         * @return {undefined}
         */
        this["load"] = this.load = function (url) {
            element.innerHTML = 'loading ' + url;
            // open the odf container
            odfcontainer = new odf.OdfContainer(url, function (container) {
                odfcontainer = container;
                refreshOdf(container);
            });
            odfcontainer.onstatereadychange = refreshOdf;
        };

        function stopEditing() {
            if (!editparagraph) {
                return;
            }
            var fragment = editparagraph.ownerDocument.createDocumentFragment();
            while (editparagraph.firstChild) {
                fragment.insertBefore(editparagraph.firstChild, null);
            }
            editparagraph.parentNode.replaceChild(fragment, editparagraph);
        }

        this.save = function (callback) {
            stopEditing();
            odfcontainer.save(callback);
        };

        function cancelPropagation(event) {
            if (event.stopPropagation) {
                event.stopPropagation();
            } else {
                event.cancelBubble = true;
            }
        }

        function cancelEvent(event) {
            if (event.preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            } else {
                event.returnValue = false;
                event.cancelBubble = true;
            }
        }

        this.setEditable = function (iseditable) {
            editable = iseditable;
            if (!editable) {
                stopEditing();
            }
        };

        function processClick(evt) {
            evt = evt || window.event;
            // go up until we find a text:p, if we find it, wrap it in <p> and
            // make that editable
            var e = evt.target, selection = window.getSelection(),
                range = selection.getRangeAt(0),
                startContainer = range && range.startContainer,
                startOffset = range && range.startOffset,
                endContainer = range && range.endContainer,
                endOffset = range && range.endOffset;

            while (e && !((e.localName === "p" || e.localName === "h") &&
                    e.namespaceURI === textns)) {
                e = e.parentNode;
            }
            if (!editable) {
                return;
            }
            // test code for enabling editing
            if (!e || e.parentNode === editparagraph) {
                return;
            }

            if (!editparagraph) {
                editparagraph = e.ownerDocument.createElement("p");
                if (!editparagraph.style) {
                   editparagraph = e.ownerDocument.createElementNS(
                       "http://www.w3.org/1999/xhtml", "p");
                }
                editparagraph.style.margin = "0px";
                editparagraph.style.padding = "0px";
                editparagraph.style.border = "0px";
                editparagraph.setAttribute("contenteditable", true);
            } else if (editparagraph.parentNode) {
                stopEditing();
            }
            e.parentNode.replaceChild(editparagraph, e);
            editparagraph.appendChild(e);

            // set the cursor or selection at the right position
            editparagraph.focus(); // needed in FF to show cursor in the paragraph
            if (range) {
                selection.removeAllRanges();
                range = e.ownerDocument.createRange();
                range.setStart(startContainer, startOffset);
                range.setEnd(endContainer, endOffset);
                selection.addRange(range);
            }
            cancelEvent(evt);
        }

        /**
         * @param {!string} eventName
         * @param {!function(*)} handler
         * @return {undefined}
         */
        this.addListener = function (eventName, handler) {
            if (eventName === "selectionchange") {
                selectionWatcher.addListener(eventName, handler);
            } else {
                addEventListener(eventName, handler);
            }
        };
        /**
         * @return {!odf.Formatting}
         */
        this.getFormatting = function () {
            return formatting;
        };

        listenEvent(element, "click", processClick);
    };
    return odf.OdfCanvas;
}());
