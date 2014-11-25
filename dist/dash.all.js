/*
 Copyright 2011 Abdulla Abdurakhmanov
 Original sources are available at https://code.google.com/p/x2js/

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

function X2JS(matchers, attrPrefix, ignoreRoot) {
    if (attrPrefix === null || attrPrefix === undefined) {
        attrPrefix = "_";
    }
    
    if (ignoreRoot === null || ignoreRoot === undefined) {
        ignoreRoot = false;
    }
    
	var VERSION = "1.0.11";
	var escapeMode = false;

	var DOMNodeTypes = {
		ELEMENT_NODE 	   : 1,
		TEXT_NODE    	   : 3,
		CDATA_SECTION_NODE : 4,
		COMMENT_NODE       : 8,
		DOCUMENT_NODE 	   : 9
	};
	
	function getNodeLocalName( node ) {
		var nodeLocalName = node.localName;			
		if(nodeLocalName == null) // Yeah, this is IE!! 
			nodeLocalName = node.baseName;
		if(nodeLocalName == null || nodeLocalName=="") // =="" is IE too
			nodeLocalName = node.nodeName;
		return nodeLocalName;
	}
	
	function getNodePrefix(node) {
		return node.prefix;
	}
		
	function escapeXmlChars(str) {
		if(typeof(str) == "string")
			return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
		else
			return str;
	}

	function unescapeXmlChars(str) {
		return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, '\/')
	}	

	function parseDOMChildren( node ) {
		if(node.nodeType == DOMNodeTypes.DOCUMENT_NODE) {
			var result,
			    child = node.firstChild,
			    i,
			    len; 
			
			// get the first node that isn't a comment
			for(i = 0, len = node.childNodes.length; i < len; i += 1) {
			   if (node.childNodes[i].nodeType !== DOMNodeTypes.COMMENT_NODE) {
			       child = node.childNodes[i];
			       break;
			   } 
			}
			
			if ( ignoreRoot ) {
			    result = parseDOMChildren(child);
			} else {
			    result = {};
			    var childName = getNodeLocalName(child);
                result[childName] = parseDOMChildren(child);
			}
			
			return result;
		}
		else
		if(node.nodeType == DOMNodeTypes.ELEMENT_NODE) {
			var result = new Object;
			result.__cnt=0;
			
			var nodeChildren = node.childNodes;
			
			// Children nodes
			for(var cidx=0; cidx <nodeChildren.length; cidx++) {
				var child = nodeChildren.item(cidx); // nodeChildren[cidx];
				var childName = getNodeLocalName(child);
				
				result.__cnt++;
				if(result[childName] == null) {
					result[childName] = parseDOMChildren(child);
					result[childName+"_asArray"] = new Array(1);
					result[childName+"_asArray"][0] = result[childName];
				}
				else {
					if(result[childName] != null) {
						if( !(result[childName] instanceof Array)) {
							var tmpObj = result[childName];
							result[childName] = new Array();
							result[childName][0] = tmpObj;
							
							result[childName+"_asArray"] = result[childName];
						}
					}
					var aridx = 0;
					while(result[childName][aridx]!=null) aridx++;
					(result[childName])[aridx] = parseDOMChildren(child);
				}			
			}
			
			// Attributes
			for(var aidx=0; aidx <node.attributes.length; aidx++) {
				var attr = node.attributes.item(aidx); // [aidx];
				result.__cnt++;
				
				var value2 = attr.value;
				for(var m=0, ml=matchers.length; m < ml; m++) {
				    var matchobj = matchers[m];
				    if (matchobj.test.call(this, attr.value))
				        value2 = matchobj.converter.call(this, attr.value);
				}
				
				result[attrPrefix+attr.name]=value2;
			}
			
			// Node namespace prefix
			var nodePrefix = getNodePrefix(node);
			if(nodePrefix!=null && nodePrefix!="") {
				result.__cnt++;
				result.__prefix=nodePrefix;
			}
			
			if( result.__cnt == 1 && result["#text"]!=null  ) {
				result = result["#text"];
			} 
			
			if(result["#text"]!=null) {
				result.__text = result["#text"];
				if(escapeMode)
					result.__text = unescapeXmlChars(result.__text)
				delete result["#text"];
				delete result["#text_asArray"];
			}
			if(result["#cdata-section"]!=null) {
				result.__cdata = result["#cdata-section"];
				delete result["#cdata-section"];
				delete result["#cdata-section_asArray"];
			}
			
			if(result.__text!=null || result.__cdata!=null) {
				result.toString = function() {
					return (this.__text!=null? this.__text:'')+( this.__cdata!=null ? this.__cdata:'');
				}
			}
			return result;
		}
		else
		if(node.nodeType == DOMNodeTypes.TEXT_NODE || node.nodeType == DOMNodeTypes.CDATA_SECTION_NODE) {
			return node.nodeValue;
		}	
		else
		if(node.nodeType == DOMNodeTypes.COMMENT_NODE) {
		    return null;
		}
	}
	
	function startTag(jsonObj, element, attrList, closed) {
		var resultStr = "<"+ ( (jsonObj!=null && jsonObj.__prefix!=null)? (jsonObj.__prefix+":"):"") + element;
		if(attrList!=null) {
			for(var aidx = 0; aidx < attrList.length; aidx++) {
				var attrName = attrList[aidx];
				var attrVal = jsonObj[attrName];
				resultStr+=" "+attrName.substr(1)+"='"+attrVal+"'";
			}
		}
		if(!closed)
			resultStr+=">";
		else
			resultStr+="/>";
		return resultStr;
	}
	
	function endTag(jsonObj,elementName) {
		return "</"+ (jsonObj.__prefix!=null? (jsonObj.__prefix+":"):"")+elementName+">";
	}
	
	function endsWith(str, suffix) {
	    return str.indexOf(suffix, str.length - suffix.length) !== -1;
	}
	
	function jsonXmlSpecialElem ( jsonObj, jsonObjField ) {
		if(endsWith(jsonObjField.toString(),("_asArray")) 
				|| jsonObjField.toString().indexOf("_")==0 
				|| (jsonObj[jsonObjField] instanceof Function) )
			return true;
		else
			return false;
	}
	
	function jsonXmlElemCount ( jsonObj ) {
		var elementsCnt = 0;
		if(jsonObj instanceof Object ) {
			for( var it in jsonObj  ) {
				if(jsonXmlSpecialElem ( jsonObj, it) )
					continue;			
				elementsCnt++;
			}
		}
		return elementsCnt;
	}
	
	function parseJSONAttributes ( jsonObj ) {
		var attrList = [];
		if(jsonObj instanceof Object ) {
			for( var ait in jsonObj  ) {
				if(ait.toString().indexOf("__")== -1 && ait.toString().indexOf("_")==0) {
					attrList.push(ait);
				}
			}
		}
		return attrList;
	}
	
	function parseJSONTextAttrs ( jsonTxtObj ) {
		var result ="";
		
		if(jsonTxtObj.__cdata!=null) {										
			result+="<![CDATA["+jsonTxtObj.__cdata+"]]>";					
		}
		
		if(jsonTxtObj.__text!=null) {			
			if(escapeMode)
				result+=escapeXmlChars(jsonTxtObj.__text);
			else
				result+=jsonTxtObj.__text;
		}
		return result
	}
	
	function parseJSONTextObject ( jsonTxtObj ) {
		var result ="";

		if( jsonTxtObj instanceof Object ) {
			result+=parseJSONTextAttrs ( jsonTxtObj )
		}
		else
			if(jsonTxtObj!=null) {
				if(escapeMode)
					result+=escapeXmlChars(jsonTxtObj);
				else
					result+=jsonTxtObj;
			}
		
		return result;
	}
	
	function parseJSONArray ( jsonArrRoot, jsonArrObj, attrList ) {
		var result = ""; 
		if(jsonArrRoot.length == 0) {
			result+=startTag(jsonArrRoot, jsonArrObj, attrList, true);
		}
		else {
			for(var arIdx = 0; arIdx < jsonArrRoot.length; arIdx++) {
				result+=startTag(jsonArrRoot[arIdx], jsonArrObj, parseJSONAttributes(jsonArrRoot[arIdx]), false);
				result+=parseJSONObject(jsonArrRoot[arIdx]);
				result+=endTag(jsonArrRoot[arIdx],jsonArrObj);						
			}
		}
		return result;
	}
	
	function parseJSONObject ( jsonObj ) {
		var result = "";	

		var elementsCnt = jsonXmlElemCount ( jsonObj );
		
		if(elementsCnt > 0) {
			for( var it in jsonObj ) {
				
				if(jsonXmlSpecialElem ( jsonObj, it) )
					continue;			
				
				var subObj = jsonObj[it];						
				
				var attrList = parseJSONAttributes( subObj )
				
				if(subObj == null || subObj == undefined) {
					result+=startTag(subObj, it, attrList, true)
				}
				else
				if(subObj instanceof Object) {
					
					if(subObj instanceof Array) {					
						result+=parseJSONArray( subObj, it, attrList )					
					}
					else {
						var subObjElementsCnt = jsonXmlElemCount ( subObj );
						if(subObjElementsCnt > 0 || subObj.__text!=null || subObj.__cdata!=null) {
							result+=startTag(subObj, it, attrList, false);
							result+=parseJSONObject(subObj);
							result+=endTag(subObj,it);
						}
						else {
							result+=startTag(subObj, it, attrList, true);
						}
					}
				}
				else {
					result+=startTag(subObj, it, attrList, false);
					result+=parseJSONTextObject(subObj);
					result+=endTag(subObj,it);
				}
			}
		}
		result+=parseJSONTextObject(jsonObj);
		
		return result;
	}
	
	this.parseXmlString = function(xmlDocStr) {
		var xmlDoc;
		if (window.DOMParser) {
			var parser=new window.DOMParser();			
			xmlDoc = parser.parseFromString( xmlDocStr, "text/xml" );
		}
		else {
			// IE :(
			if(xmlDocStr.indexOf("<?")==0) {
				xmlDocStr = xmlDocStr.substr( xmlDocStr.indexOf("?>") + 2 );
			}
			xmlDoc=new ActiveXObject("Microsoft.XMLDOM");
			xmlDoc.async="false";
			xmlDoc.loadXML(xmlDocStr);
		}
		return xmlDoc;
	}

	this.xml2json = function (xmlDoc) {
		return parseDOMChildren ( xmlDoc );
	}
	
	this.xml_str2json = function (xmlDocStr) {
		var xmlDoc = this.parseXmlString(xmlDocStr);	
		return this.xml2json(xmlDoc);
	}

	this.json2xml_str = function (jsonObj) {
		return parseJSONObject ( jsonObj );
	}

	this.json2xml = function (jsonObj) {
		var xmlDocStr = this.json2xml_str (jsonObj);
		return this.parseXmlString(xmlDocStr);
	}
	
	this.getVersion = function () {
		return VERSION;
	}		
	
	this.escapeMode = function(enabled) {
		escapeMode = enabled;
	}
};/*
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * author Digital Primates
 * copyright dash-if 2012
 */

/*
 * var parent,
 *     child,
 *     properties = [
                    {
                        name: 'profiles',
                        merge: false
                    }
                ];
 *
 * parent = {};
 * parent.name = "ParentNode";
 * parent.isRoor = false;
 * parent.isArray = false;
 * parent.parent = null;
 * parent.children = [];
 * parent.properties = properties;
 *
 * child = {};
 * child.name = "ChildNode";
 * child.isRoor = false;
 * child.isArray = true;
 * child.parent = parent;
 * child.children = null;
 * child.properties = properties;
 * parent.children.push(child);
 *
 */

function ObjectIron(map) {

    var lookup;

    // create a list of top level items to search for
    lookup = [];
    for (i = 0, len = map.length; i < len; i += 1) {
        if (map[i].isRoot) {
            lookup.push("root");
        } else {
            lookup.push(map[i].name);
        }
    }

    var mergeValues = function (parentItem, childItem) {
            var name,
                parentValue,
                childValue;

            if (parentItem === null || childItem === null) {
                return;
            }

            for (name in parentItem) {
                if (parentItem.hasOwnProperty(name)) {
                    if (!childItem.hasOwnProperty(name)) {
                        childItem[name] = parentItem[name];
                    }
                }
            }
        },

        mapProperties = function (properties, parent, child) {
            var i,
                len,
                property,
                parentValue,
                childValue;

            if (properties === null || properties.length === 0) {
                return;
            }

            for (i = 0, len = properties.length; i < len; i += 1) {
                property = properties[i];

                if (parent.hasOwnProperty(property.name)) {
                    if (child.hasOwnProperty(property.name)) {
                        // check to see if we should merge
                        if (property.merge) {
                           parentValue = parent[property.name];
                           childValue = child[property.name];

                            // complex objects; merge properties
                            if (typeof parentValue === 'object' && typeof childValue === 'object') {
                                mergeValues(parentValue, childValue);
                            }
                            // simple objects; merge them together
                            else {
                                if (property.mergeFunction != null) {
                                    child[property.name] = property.mergeFunction(parentValue, childValue);
                                } else {
                                    child[property.name] = parentValue + childValue;
                                }
                            }
                        }
                    } else {
                        // just add the property
                        child[property.name] = parent[property.name];
                    }
                }
            }
        },

        mapItem = function (obj, node) {
            var item = obj,
                i,
                len,
                v,
                len2,
                array,
                childItem,
                childNode,
                property;

            if (item.children === null || item.children.length === 0) {
                return;
            }

            for (i = 0, len = item.children.length; i < len; i += 1) {
                childItem = item.children[i];

                if (node.hasOwnProperty(childItem.name)) {
                    if (childItem.isArray) {
                        array = node[childItem.name + "_asArray"];
                        for (v = 0, len2 = array.length; v < len2; v += 1) {
                            childNode = array[v];
                            mapProperties(item.properties, node, childNode);
                            mapItem(childItem, childNode);
                        }
                    } else {
                        childNode = node[childItem.name];
                        mapProperties(item.properties, node, childNode);
                        mapItem(childItem, childNode);
                    }
                }
            }
        },

        performMapping = function (source) {
            var i,
                len,
                pi,
                pp,
                item,
                node,
                array;

            if (source === null) {
                return source;
            }

            if (typeof source !== 'object') {
                return source;
            }

            // first look to see if anything cares about the root node
            for (i = 0, len = lookup.length; i < len; i += 1) {
                if (lookup[i] === "root") {
                    item = map[i];
                    node = source;
                    mapItem(item, node);
                }
            }

            // iterate over the objects and look for any of the items we care about
            for (pp in source) {
                if (source.hasOwnProperty(pp)) {
                    pi = lookup.indexOf(pp);
                    if (pi !== -1) {
                        item = map[pi];

                        if (item.isArray) {
                            array = source[pp + "_asArray"];
                            for (i = 0, len = array.length; i < len; i += 1) {
                                node = array[i];
                                mapItem(item, node);
                            }
                        } else {
                            node = source[pp];
                            mapItem(item, node);
                        }
                    }
                    // now check this to see if he has any of the properties we care about
                    performMapping(source[pp]);
                }
            }

            return source;
        };

    return {
        run: performMapping
    };
};/**
 * @author <a href="http://www.creynders.be">Camille Reynders</a>
 */
( function ( scope ) {

    "use strict";

    /**
     * @namespace
     */
    var dijon = {
        /**
         * framework version number
         * @constant
         * @type String
         */
        VERSION:'0.5.3'
    };//dijon


    //======================================//
    // dijon.System
    //======================================//

    /**
     * @class dijon.System
     * @constructor
     */
    dijon.System = function () {
        /** @private */
        this._mappings = {};

        /** @private */
        this._outlets = {};

        /** @private */
        this._handlers = {};

        /**
         * When <code>true</code> injections are made only if an object has a property with the mapped outlet name.<br/>
         * <strong>Set to <code>false</code> at own risk</strong>, may have quite undesired side effects.
         * @example
         * system.strictInjections = true
         * var o = {};
         * system.mapSingleton( 'userModel', UserModel );
         * system.mapOutlet( 'userModel' );
         * system.injectInto( o );
         *
         * //o is unchanged
         *
         * system.strictInjections = false;
         * system.injectInto( o );
         *
         * //o now has a member 'userModel' which holds a reference to the singleton instance
         * //of UserModel
         * @type Boolean
         * @default true
         */
        this.strictInjections = true;

        /**
         * Enables the automatic mapping of outlets for mapped values, singletons and classes
         * When this is true any value, singleton or class that is mapped will automatically be mapped as a global outlet
         * using the value of <code>key</code> as outlet name
         *
         * @example
         * var o = {
         *     userModel : undefined; //inject
         * }
         * system.mapSingleton( 'userModel', UserModel );
         * system.injectInto( o ):
         * //o.userModel now holds a reference to the singleton instance of UserModel
         * @type Boolean
         * @default false
         */
        this.autoMapOutlets = false;

        /**
         * The name of the method that will be called for all instances, right after injection has occured.
         * @type String
         * @default 'setup'
         */
        this.postInjectionHook = 'setup';

    };//dijon.System

    dijon.System.prototype = {

        /**
         * @private
         * @param {Class} clazz
         */
        _createAndSetupInstance:function ( key, Clazz ) {
            var instance = new Clazz();
            this.injectInto( instance, key );
            return instance;
        },

        /**
         * @private
         * @param {String} key
         * @param {Boolean} overrideRules
         * @return {Object}
         */
        _retrieveFromCacheOrCreate:function ( key, overrideRules ) {
            if ( typeof overrideRules === 'undefined' ) {
                overrideRules = false;
            }
            var output;
            if ( this._mappings.hasOwnProperty( key ) ) {
                var config = this._mappings[ key ];
                if ( !overrideRules && config.isSingleton ) {
                    if ( config.object == null ) {
                        config.object = this._createAndSetupInstance( key, config.clazz );
                    }
                    output = config.object;
                } else {
                    if ( config.clazz ) {
                        output = this._createAndSetupInstance( key, config.clazz );
                    } else {
                        //TODO shouldn't this be null
                        output = config.object;
                    }
                }
            } else {
                throw new Error( 1000 );
            }
            return output;
        },


        /**
         * defines <code>outletName</code> as an injection point in <code>targetKey</code>for the object mapped to <code>sourceKey</code>
         * @example
         system.mapSingleton( 'userModel', TestClassA );
         var o = {
         user : undefined //inject
         }
         system.mapOutlet( 'userModel', 'o', 'user' );
         system.mapValue( 'o', o );

         var obj = system.getObject( 'o' );
         * //obj.user holds a reference to the singleton instance of UserModel
         *
         * @example
         system.mapSingleton( 'userModel', TestClassA );
         var o = {
         userModel : undefined //inject
         }
         system.mapOutlet( 'userModel', 'o' );
         system.mapValue( 'o', o );

         var obj = system.getObject( 'o' );
         * //obj.userModel holds a reference to the singleton instance of UserModel
         *
         * @example
         system.mapSingleton( 'userModel', TestClassA );
         system.mapOutlet( 'userModel' );
         var o = {
         userModel : undefined //inject
         }
         system.mapValue( 'o', o );

         var obj = system.getObject( 'o' );
         * //o.userModel holds a reference to the singleton instance of userModel
         *
         * @param {String} sourceKey the key mapped to the object that will be injected
         * @param {String} [targetKey='global'] the key the outlet is assigned to.
         * @param {String} [outletName=sourceKey] the name of the property used as an outlet.<br/>
         * @return {dijon.System}
         * @see dijon.System#unmapOutlet
         */
        mapOutlet:function ( sourceKey, targetKey, outletName ) {
            if ( typeof sourceKey === 'undefined' ) {
                throw new Error( 1010 );
            }
            targetKey = targetKey || "global";
            outletName = outletName || sourceKey;

            if ( !this._outlets.hasOwnProperty( targetKey ) ) {
                this._outlets[ targetKey ] = {};
            }
            this._outlets[ targetKey ][ outletName ] = sourceKey;

            return this;
        },

        /**
         * Retrieve (or create) the object mapped to <code>key</code>
         * @example
         * system.mapValue( 'foo', 'bar' );
         * var b = system.getObject( 'foo' ); //now contains 'bar'
         * @param {Object} key
         * @return {Object}
         */
        getObject:function ( key ) {
            if ( typeof key === 'undefined' ) {
                throw new Error( 1020 );
            }
            return this._retrieveFromCacheOrCreate( key );
        },

        /**
         * Maps <code>useValue</code> to <code>key</code>
         * @example
         * system.mapValue( 'foo', 'bar' );
         * var b = system.getObject( 'foo' ); //now contains 'bar'
         * @param {String} key
         * @param {Object} useValue
         * @return {dijon.System}
         */
        mapValue:function ( key, useValue ) {
            if ( typeof key === 'undefined' ) {
                throw new Error( 1030 );
            }
            this._mappings[ key ] = {
                clazz:null,
                object:useValue,
                isSingleton:true
            };
            if ( this.autoMapOutlets ) {
                this.mapOutlet( key );
            }
            if ( this.hasMapping( key )) {
                this.injectInto( useValue, key );
            }
            return this;
        },

        /**
         * Returns whether the key is mapped to an object
         * @example
         * system.mapValue( 'foo', 'bar' );
         * var isMapped = system.hasMapping( 'foo' );
         * @param {String} key
         * @return {Boolean}
         */
        hasMapping:function ( key ) {
            if ( typeof key === 'undefined' ) {
                throw new Error( 1040 );
            }
            return this._mappings.hasOwnProperty( key );
        },

        /**
         * Maps <code>clazz</code> as a factory to <code>key</code>
         * @example
         * var SomeClass = function(){
         * }
         * system.mapClass( 'o', SomeClass );
         *
         * var s1 = system.getObject( 'o' );
         * var s2 = system.getObject( 'o' );
         *
         * //s1 and s2 reference two different instances of SomeClass
         *
         * @param {String} key
         * @param {Function} clazz
         * @return {dijon.System}
         */
        mapClass:function ( key, clazz ) {
            if ( typeof key === 'undefined' ) {
                throw new Error( 1050 );
            }
            if ( typeof clazz === 'undefined' ) {
                throw new Error( 1051 );
            }
            this._mappings[ key ] = {
                clazz:clazz,
                object:null,
                isSingleton:false
            };
            if ( this.autoMapOutlets ) {
                this.mapOutlet( key );
            }
            return this;
        },

        /**
         * Maps <code>clazz</code> as a singleton factory to <code>key</code>
         * @example
         * var SomeClass = function(){
         * }
         * system.mapSingleton( 'o', SomeClass );
         *
         * var s1 = system.getObject( 'o' );
         * var s2 = system.getObject( 'o' );
         *
         * //s1 and s2 reference the same instance of SomeClass
         *
         * @param {String} key
         * @param {Function} clazz
         * @return {dijon.System}
         */
        mapSingleton:function ( key, clazz ) {
            if ( typeof key === 'undefined' ) {
                throw new Error( 1060 );
            }
            if ( typeof clazz === 'undefined' ) {
                throw new Error( 1061 );
            }
            this._mappings[ key ] = {
                clazz:clazz,
                object:null,
                isSingleton:true
            };
            if ( this.autoMapOutlets ) {
                this.mapOutlet( key );
            }
            return this;
        },

        /**
         * Force instantiation of the class mapped to <code>key</code>, whether it was mapped as a singleton or not.
         * When a value was mapped, the value will be returned.
         * TODO: should this last rule be changed?
         * @example
         var SomeClass = function(){
         }
         system.mapClass( 'o', SomeClass );

         var s1 = system.getObject( 'o' );
         var s2 = system.getObject( 'o' );
         * //s1 and s2 reference different instances of SomeClass
         *
         * @param {String} key
         * @return {Object}
         */
        instantiate:function ( key ) {
            if ( typeof key === 'undefined' ) {
                throw new Error( 1070 );
            }
            return this._retrieveFromCacheOrCreate( key, true );
        },

        /**
         * Perform an injection into an object's mapped outlets, satisfying all it's dependencies
         * @example
         * var UserModel = function(){
         * }
         * system.mapSingleton( 'userModel', UserModel );
         * var SomeClass = function(){
         *      user = undefined; //inject
         * }
         * system.mapSingleton( 'o', SomeClass );
         * system.mapOutlet( 'userModel', 'o', 'user' );
         *
         * var foo = {
         *      user : undefined //inject
         * }
         *
         * system.injectInto( foo, 'o' );
         *
         * //foo.user now holds a reference to the singleton instance of UserModel
         * @param {Object} instance
         * @param {String} [key] use the outlet mappings as defined for <code>key</code>, otherwise only the globally
         * mapped outlets will be used.
         * @return {dijon.System}
         */
        injectInto:function ( instance, key ) {
            if ( typeof instance === 'undefined' ) {
                throw new Error( 1080 );
            }
			if( ( typeof instance === 'object' ) ){
				var o = [];
				if ( this._outlets.hasOwnProperty( 'global' ) ) {
					o.push( this._outlets[ 'global' ] );
				}
				if ( typeof key !== 'undefined' && this._outlets.hasOwnProperty( key ) ) {
					o.push( this._outlets[ key ] );
				}
				for ( var i in o ) {
					var l = o [ i ];
					for ( var outlet in l ) {
						var source = l[ outlet ];
						//must be "in" [!]
						if ( !this.strictInjections || outlet in instance ) {
							instance[ outlet ] = this.getObject( source );
						}
					}
				}
				if ( "setup" in instance ) {
					instance.setup.call( instance );
				}
			}
            return this;
        },

        /**
         * Remove the mapping of <code>key</code> from the system
         * @param {String} key
         * @return {dijon.System}
         */
        unmap:function ( key ) {
            if ( typeof key === 'undefined' ) {
                throw new Error( 1090 );
            }
            delete this._mappings[ key ];

            return this;
        },

        /**
         * removes an injection point mapping for a given object mapped to <code>key</code>
         * @param {String} target
         * @param {String} outlet
         * @return {dijon.System}
         * @see dijon.System#addOutlet
         */
        unmapOutlet:function ( target, outlet ) {
            if ( typeof target === 'undefined' ) {
                throw new Error( 1100 );
            }
            if ( typeof outlet === 'undefined' ) {
                throw new Error( 1101 );
            }
            delete this._outlets[ target ][ outlet ];

            return this;
        },

        /**
         * maps a handler for an event/route.<br/>
         * @example
         var hasExecuted = false;
         var userView = {
         showUserProfile : function(){
         hasExecuted = true;
         }
         }
         system.mapValue( 'userView', userView );
         system.mapHandler( 'user/profile', 'userView', 'showUserProfile' );
         system.notify( 'user/profile' );
         //hasExecuted is true
         * @example
         * var userView = {
         *      showUserProfile : function(){
         *          //do stuff
         *      }
         * }
         * system.mapValue( 'userView', userView );
         * <strong>system.mapHandler( 'showUserProfile', 'userView' );</strong>
         * system.notify( 'showUserProfile' );
         *
         * //userView.showUserProfile is called
         * @example
         * var showUserProfile = function(){
         *          //do stuff
         * }
         * <strong>system.mapHandler( 'user/profile', undefined, showUserProfile );</strong>
         * system.notify( 'user/profile' );
         *
         * //showUserProfile is called
         * @example
         * var userView = {};
         * var showUserProfile = function(){
         *          //do stuff
         * }
         * system.mapValue( 'userView', userView );
         * <strong>system.mapHandler( 'user/profile', 'userView', showUserProfile );</strong>
         * system.notify( 'user/profile' );
         *
         * //showUserProfile is called within the scope of the userView object
         * @example
         * var userView = {
         *      showUserProfile : function(){
         *          //do stuff
         *      }
         * }
         * system.mapValue( 'userView', userView );
         * <strong>system.mapHandler( 'user/profile', 'userView', 'showUserProfile', true );</strong>
         * system.notify( 'user/profile' );
         * system.notify( 'user/profile' );
         * system.notify( 'user/profile' );
         *
         * //userView.showUserProfile is called exactly once [!]
         * @example
         * var userView = {
         *      showUserProfile : function( route ){
         *          //do stuff
         *      }
         * }
         * system.mapValue( 'userView', userView );
         * <strong>system.mapHandler( 'user/profile', 'userView', 'showUserProfile', false, true );</strong>
         * system.notify( 'user/profile' );
         *
         * //userView.showUserProfile is called and the route/eventName is passed to the handler
         * @param {String} eventName/route
         * @param {String} [key=undefined] If <code>key</code> is <code>undefined</code> the handler will be called without
         * scope.
         * @param {String|Function} [handler=eventName] If <code>handler</code> is <code>undefined</code> the value of
         * <code>eventName</code> will be used as the name of the member holding the reference to the to-be-called function.
         * <code>handler</code> accepts either a string, which will be used as the name of the member holding the reference
         * to the to-be-called function, or a direct function reference.
         * @param {Boolean} [oneShot=false] Defines whether the handler should be called exactly once and then automatically
         * unmapped
         * @param {Boolean} [passEvent=false] Defines whether the event object should be passed to the handler or not.
         * @return {dijon.System}
         * @see dijon.System#notify
         * @see dijon.System#unmapHandler
         */
        mapHandler:function ( eventName, key, handler, oneShot, passEvent ) {
            if ( typeof eventName === 'undefined' ) {
                throw new Error( 1110 );
            }
            key = key || 'global';
            handler = handler || eventName;

            if ( typeof oneShot === 'undefined' ) {
                oneShot = false;
            }
            if ( typeof passEvent === 'undefined' ) {
                passEvent = false;
            }
            if ( !this._handlers.hasOwnProperty( eventName ) ) {
                this._handlers[ eventName ] = {};
            }
            if ( !this._handlers[eventName].hasOwnProperty( key ) ) {
                this._handlers[eventName][key] = [];
            }
            this._handlers[ eventName ][ key ].push( {
                handler:handler,
                oneShot:oneShot,
                passEvent:passEvent
            } );

            return this;
        },

        /**
         * Unmaps the handler for a specific event/route.
         * @param {String} eventName Name of the event/route
         * @param {String} [key=undefined] If <code>key</code> is <code>undefined</code> the handler is removed from the
         * global mapping space. (If the same event is mapped globally and specifically for an object, then
         * only the globally mapped one will be removed)
         * @param {String | Function} [handler=eventName]
         * @return {dijon.System}
         * @see dijon.System#mapHandler
         */
        unmapHandler:function ( eventName, key, handler ) {
            if ( typeof eventName === 'undefined' ) {
                throw new Error( 1120 );
            }
            key = key || 'global';
            handler = handler || eventName;

            if ( this._handlers.hasOwnProperty( eventName ) && this._handlers[ eventName ].hasOwnProperty( key ) ) {
                var handlers = this._handlers[ eventName ][ key ];
                for ( var i in handlers ) {
                    var config = handlers[ i ];
                    if ( config.handler === handler ) {
                        handlers.splice( i, 1 );
                        break;
                    }
                }
            }
            return this;
        },

        /**
         * calls all handlers mapped to <code>eventName/route</code>
         * @param {String} eventName/route
         * @return {dijon.System}
         * @see dijon.System#mapHandler
         */
        notify:function ( eventName ) {
            if ( typeof eventName === 'undefined' ) {
                throw new Error( 1130 );
            }
            var argsWithEvent = Array.prototype.slice.call( arguments );
            var argsClean = argsWithEvent.slice( 1 );
            if ( this._handlers.hasOwnProperty( eventName ) ) {
                var handlers = this._handlers[ eventName ];
                for ( var key in handlers ) {
                    var configs = handlers[ key ];
                    var instance;
                    if ( key !== 'global' ) {
                        instance = this.getObject( key );
                    }
                    var toBeDeleted = [];
                    var i, n;
                    for ( i = 0, n = configs.length ; i < n ; i++ ) {
                        var handler;
                        var config = configs[ i ];
                        if ( instance && typeof config.handler === "string" ) {
                            handler = instance[ config.handler ];
                        } else {
                            handler = config.handler;
                        }

                        //see deletion below
                        if ( config.oneShot ) {
                            toBeDeleted.unshift( i );
                        }

                        if ( config.passEvent ) {
                            handler.apply( instance, argsWithEvent );
                        } else {
                            handler.apply( instance, argsClean );
                        }
                    }

                    //items should be deleted in reverse order
                    //either use push above and decrement here
                    //or use unshift above and increment here
                    for ( i = 0, n = toBeDeleted.length ; i < n ; i++ ) {
                        configs.splice( toBeDeleted[ i ], 1 );
                    }
                }
            }

            return this;
        }

    };//dijon.System.prototype

    scope.dijon = dijon;
}( this ));


;/*
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * author Digital Primates
 * copyright dash-if 2012
 */ 
 if(typeof(utils) == "undefined"){
 	var utils = {};
 }
 
 if(typeof(utils.Math) == "undefined"){
 	utils.Math = {};
 }
 
 utils.Math.to64BitNumber = function(low, high) {
	var highNum, lowNum, expected;

	highNum = new goog.math.Long(0, high);
	lowNum = new goog.math.Long(low, 0);
	expected = highNum.add(lowNum);

	return expected.toNumber();
};// Copyright 2009 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

goog = {};
goog.math = {};

/**
 * @fileoverview Defines a Long class for representing a 64-bit two's-complement
 * integer value, which faithfully simulates the behavior of a Java "long". This
 * implementation is derived from LongLib in GWT.
 *
 */

//goog.provide('goog.math.Long');



/**
 * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
 * values as *signed* integers.  See the from* functions below for more
 * convenient ways of constructing Longs.
 *
 * The internal representation of a long is the two given signed, 32-bit values.
 * We use 32-bit pieces because these are the size of integers on which
 * Javascript performs bit-operations.  For operations like addition and
 * multiplication, we split each number into 16-bit pieces, which can easily be
 * multiplied within Javascript's floating-point representation without overflow
 * or change in sign.
 *
 * In the algorithms below, we frequently reduce the negative case to the
 * positive case by negating the input(s) and then post-processing the result.
 * Note that we must ALWAYS check specially whether those values are MIN_VALUE
 * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
 * a positive number, it overflows back into a negative).  Not handling this
 * case would often result in infinite recursion.
 *
 * @param {number} low  The low (signed) 32 bits of the long.
 * @param {number} high  The high (signed) 32 bits of the long.
 * @constructor
 */
goog.math.Long = function(low, high) {
  /**
   * @type {number}
   * @private
   */
  this.low_ = low | 0;  // force into 32 signed bits.

  /**
   * @type {number}
   * @private
   */
  this.high_ = high | 0;  // force into 32 signed bits.
};


// NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
// from* methods on which they depend.


/**
 * A cache of the Long representations of small integer values.
 * @type {!Object}
 * @private
 */
goog.math.Long.IntCache_ = {};


/**
 * Returns a Long representing the given (32-bit) integer value.
 * @param {number} value The 32-bit integer in question.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromInt = function(value) {
  if (-128 <= value && value < 128) {
    var cachedObj = goog.math.Long.IntCache_[value];
    if (cachedObj) {
      return cachedObj;
    }
  }

  var obj = new goog.math.Long(value | 0, value < 0 ? -1 : 0);
  if (-128 <= value && value < 128) {
    goog.math.Long.IntCache_[value] = obj;
  }
  return obj;
};


/**
 * Returns a Long representing the given value, provided that it is a finite
 * number.  Otherwise, zero is returned.
 * @param {number} value The number in question.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromNumber = function(value) {
  if (isNaN(value) || !isFinite(value)) {
    return goog.math.Long.ZERO;
  } else if (value <= -goog.math.Long.TWO_PWR_63_DBL_) {
    return goog.math.Long.MIN_VALUE;
  } else if (value + 1 >= goog.math.Long.TWO_PWR_63_DBL_) {
    return goog.math.Long.MAX_VALUE;
  } else if (value < 0) {
    return goog.math.Long.fromNumber(-value).negate();
  } else {
    return new goog.math.Long(
        (value % goog.math.Long.TWO_PWR_32_DBL_) | 0,
        (value / goog.math.Long.TWO_PWR_32_DBL_) | 0);
  }
};


/**
 * Returns a Long representing the 64-bit integer that comes by concatenating
 * the given high and low bits.  Each is assumed to use 32 bits.
 * @param {number} lowBits The low 32-bits.
 * @param {number} highBits The high 32-bits.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromBits = function(lowBits, highBits) {
  return new goog.math.Long(lowBits, highBits);
};


/**
 * Returns a Long representation of the given string, written using the given
 * radix.
 * @param {string} str The textual representation of the Long.
 * @param {number=} opt_radix The radix in which the text is written.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromString = function(str, opt_radix) {
  if (str.length == 0) {
    throw Error('number format error: empty string');
  }

  var radix = opt_radix || 10;
  if (radix < 2 || 36 < radix) {
    throw Error('radix out of range: ' + radix);
  }

  if (str.charAt(0) == '-') {
    return goog.math.Long.fromString(str.substring(1), radix).negate();
  } else if (str.indexOf('-') >= 0) {
    throw Error('number format error: interior "-" character: ' + str);
  }

  // Do several (8) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 8));

  var result = goog.math.Long.ZERO;
  for (var i = 0; i < str.length; i += 8) {
    var size = Math.min(8, str.length - i);
    var value = parseInt(str.substring(i, i + size), radix);
    if (size < 8) {
      var power = goog.math.Long.fromNumber(Math.pow(radix, size));
      result = result.multiply(power).add(goog.math.Long.fromNumber(value));
    } else {
      result = result.multiply(radixToPower);
      result = result.add(goog.math.Long.fromNumber(value));
    }
  }
  return result;
};


// NOTE: the compiler should inline these constant values below and then remove
// these variables, so there should be no runtime penalty for these.


/**
 * Number used repeated below in calculations.  This must appear before the
 * first call to any from* function below.
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_16_DBL_ = 1 << 16;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_24_DBL_ = 1 << 24;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_32_DBL_ =
    goog.math.Long.TWO_PWR_16_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_31_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ / 2;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_48_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_64_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_32_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_63_DBL_ =
    goog.math.Long.TWO_PWR_64_DBL_ / 2;


/** @type {!goog.math.Long} */
goog.math.Long.ZERO = goog.math.Long.fromInt(0);


/** @type {!goog.math.Long} */
goog.math.Long.ONE = goog.math.Long.fromInt(1);


/** @type {!goog.math.Long} */
goog.math.Long.NEG_ONE = goog.math.Long.fromInt(-1);


/** @type {!goog.math.Long} */
goog.math.Long.MAX_VALUE =
    goog.math.Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);


/** @type {!goog.math.Long} */
goog.math.Long.MIN_VALUE = goog.math.Long.fromBits(0, 0x80000000 | 0);


/**
 * @type {!goog.math.Long}
 * @private
 */
goog.math.Long.TWO_PWR_24_ = goog.math.Long.fromInt(1 << 24);


/** @return {number} The value, assuming it is a 32-bit integer. */
goog.math.Long.prototype.toInt = function() {
  return this.low_;
};


/** @return {number} The closest floating-point representation to this value. */
goog.math.Long.prototype.toNumber = function() {
  return this.high_ * goog.math.Long.TWO_PWR_32_DBL_ +
         this.getLowBitsUnsigned();
};


/**
 * @param {number=} opt_radix The radix in which the text should be written.
 * @return {string} The textual representation of this value.
 * @override
 */
goog.math.Long.prototype.toString = function(opt_radix) {
  var radix = opt_radix || 10;
  if (radix < 2 || 36 < radix) {
    throw Error('radix out of range: ' + radix);
  }

  if (this.isZero()) {
    return '0';
  }

  if (this.isNegative()) {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      // We need to change the Long value before it can be negated, so we remove
      // the bottom-most digit in this base and then recurse to do the rest.
      var radixLong = goog.math.Long.fromNumber(radix);
      var div = this.div(radixLong);
      var rem = div.multiply(radixLong).subtract(this);
      return div.toString(radix) + rem.toInt().toString(radix);
    } else {
      return '-' + this.negate().toString(radix);
    }
  }

  // Do several (6) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 6));

  var rem = this;
  var result = '';
  while (true) {
    var remDiv = rem.div(radixToPower);
    var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
    var digits = intval.toString(radix);

    rem = remDiv;
    if (rem.isZero()) {
      return digits + result;
    } else {
      while (digits.length < 6) {
        digits = '0' + digits;
      }
      result = '' + digits + result;
    }
  }
};


/** @return {number} The high 32-bits as a signed value. */
goog.math.Long.prototype.getHighBits = function() {
  return this.high_;
};


/** @return {number} The low 32-bits as a signed value. */
goog.math.Long.prototype.getLowBits = function() {
  return this.low_;
};


/** @return {number} The low 32-bits as an unsigned value. */
goog.math.Long.prototype.getLowBitsUnsigned = function() {
  return (this.low_ >= 0) ?
      this.low_ : goog.math.Long.TWO_PWR_32_DBL_ + this.low_;
};


/**
 * @return {number} Returns the number of bits needed to represent the absolute
 *     value of this Long.
 */
goog.math.Long.prototype.getNumBitsAbs = function() {
  if (this.isNegative()) {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return 64;
    } else {
      return this.negate().getNumBitsAbs();
    }
  } else {
    var val = this.high_ != 0 ? this.high_ : this.low_;
    for (var bit = 31; bit > 0; bit--) {
      if ((val & (1 << bit)) != 0) {
        break;
      }
    }
    return this.high_ != 0 ? bit + 33 : bit + 1;
  }
};


/** @return {boolean} Whether this value is zero. */
goog.math.Long.prototype.isZero = function() {
  return this.high_ == 0 && this.low_ == 0;
};


/** @return {boolean} Whether this value is negative. */
goog.math.Long.prototype.isNegative = function() {
  return this.high_ < 0;
};


/** @return {boolean} Whether this value is odd. */
goog.math.Long.prototype.isOdd = function() {
  return (this.low_ & 1) == 1;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long equals the other.
 */
goog.math.Long.prototype.equals = function(other) {
  return (this.high_ == other.high_) && (this.low_ == other.low_);
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long does not equal the other.
 */
goog.math.Long.prototype.notEquals = function(other) {
  return (this.high_ != other.high_) || (this.low_ != other.low_);
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is less than the other.
 */
goog.math.Long.prototype.lessThan = function(other) {
  return this.compare(other) < 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is less than or equal to the other.
 */
goog.math.Long.prototype.lessThanOrEqual = function(other) {
  return this.compare(other) <= 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is greater than the other.
 */
goog.math.Long.prototype.greaterThan = function(other) {
  return this.compare(other) > 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is greater than or equal to the other.
 */
goog.math.Long.prototype.greaterThanOrEqual = function(other) {
  return this.compare(other) >= 0;
};


/**
 * Compares this Long with the given one.
 * @param {goog.math.Long} other Long to compare against.
 * @return {number} 0 if they are the same, 1 if the this is greater, and -1
 *     if the given one is greater.
 */
goog.math.Long.prototype.compare = function(other) {
  if (this.equals(other)) {
    return 0;
  }

  var thisNeg = this.isNegative();
  var otherNeg = other.isNegative();
  if (thisNeg && !otherNeg) {
    return -1;
  }
  if (!thisNeg && otherNeg) {
    return 1;
  }

  // at this point, the signs are the same, so subtraction will not overflow
  if (this.subtract(other).isNegative()) {
    return -1;
  } else {
    return 1;
  }
};


/** @return {!goog.math.Long} The negation of this value. */
goog.math.Long.prototype.negate = function() {
  if (this.equals(goog.math.Long.MIN_VALUE)) {
    return goog.math.Long.MIN_VALUE;
  } else {
    return this.not().add(goog.math.Long.ONE);
  }
};


/**
 * Returns the sum of this and the given Long.
 * @param {goog.math.Long} other Long to add to this one.
 * @return {!goog.math.Long} The sum of this and the given Long.
 */
goog.math.Long.prototype.add = function(other) {
  // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

  var a48 = this.high_ >>> 16;
  var a32 = this.high_ & 0xFFFF;
  var a16 = this.low_ >>> 16;
  var a00 = this.low_ & 0xFFFF;

  var b48 = other.high_ >>> 16;
  var b32 = other.high_ & 0xFFFF;
  var b16 = other.low_ >>> 16;
  var b00 = other.low_ & 0xFFFF;

  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  c00 += a00 + b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 + b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 + b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 + b48;
  c48 &= 0xFFFF;
  return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
};


/**
 * Returns the difference of this and the given Long.
 * @param {goog.math.Long} other Long to subtract from this.
 * @return {!goog.math.Long} The difference of this and the given Long.
 */
goog.math.Long.prototype.subtract = function(other) {
  return this.add(other.negate());
};


/**
 * Returns the product of this and the given long.
 * @param {goog.math.Long} other Long to multiply with this.
 * @return {!goog.math.Long} The product of this and the other.
 */
goog.math.Long.prototype.multiply = function(other) {
  if (this.isZero()) {
    return goog.math.Long.ZERO;
  } else if (other.isZero()) {
    return goog.math.Long.ZERO;
  }

  if (this.equals(goog.math.Long.MIN_VALUE)) {
    return other.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
  } else if (other.equals(goog.math.Long.MIN_VALUE)) {
    return this.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
  }

  if (this.isNegative()) {
    if (other.isNegative()) {
      return this.negate().multiply(other.negate());
    } else {
      return this.negate().multiply(other).negate();
    }
  } else if (other.isNegative()) {
    return this.multiply(other.negate()).negate();
  }

  // If both longs are small, use float multiplication
  if (this.lessThan(goog.math.Long.TWO_PWR_24_) &&
      other.lessThan(goog.math.Long.TWO_PWR_24_)) {
    return goog.math.Long.fromNumber(this.toNumber() * other.toNumber());
  }

  // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
  // We can skip products that would overflow.

  var a48 = this.high_ >>> 16;
  var a32 = this.high_ & 0xFFFF;
  var a16 = this.low_ >>> 16;
  var a00 = this.low_ & 0xFFFF;

  var b48 = other.high_ >>> 16;
  var b32 = other.high_ & 0xFFFF;
  var b16 = other.low_ >>> 16;
  var b00 = other.low_ & 0xFFFF;

  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  c00 += a00 * b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 * b00;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c16 += a00 * b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 * b00;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a16 * b16;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a00 * b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
  c48 &= 0xFFFF;
  return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
};


/**
 * Returns this Long divided by the given one.
 * @param {goog.math.Long} other Long by which to divide.
 * @return {!goog.math.Long} This Long divided by the given one.
 */
goog.math.Long.prototype.div = function(other) {
  if (other.isZero()) {
    throw Error('division by zero');
  } else if (this.isZero()) {
    return goog.math.Long.ZERO;
  }

  if (this.equals(goog.math.Long.MIN_VALUE)) {
    if (other.equals(goog.math.Long.ONE) ||
        other.equals(goog.math.Long.NEG_ONE)) {
      return goog.math.Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.ONE;
    } else {
      // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
      var halfThis = this.shiftRight(1);
      var approx = halfThis.div(other).shiftLeft(1);
      if (approx.equals(goog.math.Long.ZERO)) {
        return other.isNegative() ? goog.math.Long.ONE : goog.math.Long.NEG_ONE;
      } else {
        var rem = this.subtract(other.multiply(approx));
        var result = approx.add(rem.div(other));
        return result;
      }
    }
  } else if (other.equals(goog.math.Long.MIN_VALUE)) {
    return goog.math.Long.ZERO;
  }

  if (this.isNegative()) {
    if (other.isNegative()) {
      return this.negate().div(other.negate());
    } else {
      return this.negate().div(other).negate();
    }
  } else if (other.isNegative()) {
    return this.div(other.negate()).negate();
  }

  // Repeat the following until the remainder is less than other:  find a
  // floating-point that approximates remainder / other *from below*, add this
  // into the result, and subtract it from the remainder.  It is critical that
  // the approximate value is less than or equal to the real value so that the
  // remainder never becomes negative.
  var res = goog.math.Long.ZERO;
  var rem = this;
  while (rem.greaterThanOrEqual(other)) {
    // Approximate the result of division. This may be a little greater or
    // smaller than the actual value.
    var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

    // We will tweak the approximate result by changing it in the 48-th digit or
    // the smallest non-fractional digit, whichever is larger.
    var log2 = Math.ceil(Math.log(approx) / Math.LN2);
    var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

    // Decrease the approximation until it is smaller than the remainder.  Note
    // that if it is too large, the product overflows and is negative.
    var approxRes = goog.math.Long.fromNumber(approx);
    var approxRem = approxRes.multiply(other);
    while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
      approx -= delta;
      approxRes = goog.math.Long.fromNumber(approx);
      approxRem = approxRes.multiply(other);
    }

    // We know the answer can't be zero... and actually, zero would cause
    // infinite recursion since we would make no progress.
    if (approxRes.isZero()) {
      approxRes = goog.math.Long.ONE;
    }

    res = res.add(approxRes);
    rem = rem.subtract(approxRem);
  }
  return res;
};


/**
 * Returns this Long modulo the given one.
 * @param {goog.math.Long} other Long by which to mod.
 * @return {!goog.math.Long} This Long modulo the given one.
 */
goog.math.Long.prototype.modulo = function(other) {
  return this.subtract(this.div(other).multiply(other));
};


/** @return {!goog.math.Long} The bitwise-NOT of this value. */
goog.math.Long.prototype.not = function() {
  return goog.math.Long.fromBits(~this.low_, ~this.high_);
};


/**
 * Returns the bitwise-AND of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to AND.
 * @return {!goog.math.Long} The bitwise-AND of this and the other.
 */
goog.math.Long.prototype.and = function(other) {
  return goog.math.Long.fromBits(this.low_ & other.low_,
                                 this.high_ & other.high_);
};


/**
 * Returns the bitwise-OR of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to OR.
 * @return {!goog.math.Long} The bitwise-OR of this and the other.
 */
goog.math.Long.prototype.or = function(other) {
  return goog.math.Long.fromBits(this.low_ | other.low_,
                                 this.high_ | other.high_);
};


/**
 * Returns the bitwise-XOR of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to XOR.
 * @return {!goog.math.Long} The bitwise-XOR of this and the other.
 */
goog.math.Long.prototype.xor = function(other) {
  return goog.math.Long.fromBits(this.low_ ^ other.low_,
                                 this.high_ ^ other.high_);
};


/**
 * Returns this Long with bits shifted to the left by the given amount.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the left by the given amount.
 */
goog.math.Long.prototype.shiftLeft = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var low = this.low_;
    if (numBits < 32) {
      var high = this.high_;
      return goog.math.Long.fromBits(
          low << numBits,
          (high << numBits) | (low >>> (32 - numBits)));
    } else {
      return goog.math.Long.fromBits(0, low << (numBits - 32));
    }
  }
};


/**
 * Returns this Long with bits shifted to the right by the given amount.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the right by the given amount.
 */
goog.math.Long.prototype.shiftRight = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var high = this.high_;
    if (numBits < 32) {
      var low = this.low_;
      return goog.math.Long.fromBits(
          (low >>> numBits) | (high << (32 - numBits)),
          high >> numBits);
    } else {
      return goog.math.Long.fromBits(
          high >> (numBits - 32),
          high >= 0 ? 0 : -1);
    }
  }
};


/**
 * Returns this Long with bits shifted to the right by the given amount, with
 * the new top bits matching the current sign bit.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the right by the given amount, with
 *     zeros placed into the new leading bits.
 */
goog.math.Long.prototype.shiftRightUnsigned = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var high = this.high_;
    if (numBits < 32) {
      var low = this.low_;
      return goog.math.Long.fromBits(
          (low >>> numBits) | (high << (32 - numBits)),
          high >>> numBits);
    } else if (numBits == 32) {
      return goog.math.Long.fromBits(high, 0);
    } else {
      return goog.math.Long.fromBits(high >>> (numBits - 32), 0);
    }
  }
};;/* $Date: 2007-06-12 18:02:31 $ */

// from: http://bannister.us/weblog/2007/06/09/simple-base64-encodedecode-javascript/
// Handles encode/decode of ASCII and Unicode strings.

var UTF8 = {};
UTF8.encode = function(s) {
    var u = [];
    for (var i = 0; i < s.length; ++i) {
        var c = s.charCodeAt(i);
        if (c < 0x80) {
            u.push(c);
        } else if (c < 0x800) {
            u.push(0xC0 | (c >> 6));
            u.push(0x80 | (63 & c));
        } else if (c < 0x10000) {
            u.push(0xE0 | (c >> 12));
            u.push(0x80 | (63 & (c >> 6)));
            u.push(0x80 | (63 & c));
        } else {
            u.push(0xF0 | (c >> 18));
            u.push(0x80 | (63 & (c >> 12)));
            u.push(0x80 | (63 & (c >> 6)));
            u.push(0x80 | (63 & c));
        }
    }
    return u;
};
UTF8.decode = function(u) {
    var a = [];
    var i = 0;
    while (i < u.length) {
        var v = u[i++];
        if (v < 0x80) {
            // no need to mask byte
        } else if (v < 0xE0) {
            v = (31 & v) << 6;
            v |= (63 & u[i++]);
        } else if (v < 0xF0) {
            v = (15 & v) << 12;
            v |= (63 & u[i++]) << 6;
            v |= (63 & u[i++]);
        } else {
            v = (7 & v) << 18;
            v |= (63 & u[i++]) << 12;
            v |= (63 & u[i++]) << 6;
            v |= (63 & u[i++]);
        }
        a.push(String.fromCharCode(v));
    }
    return a.join('');
};

var BASE64 = {};
(function(T){
    var encodeArray = function(u) {
        var i = 0;
        var a = [];
        var n = 0 | (u.length / 3);
        while (0 < n--) {
            var v = (u[i] << 16) + (u[i+1] << 8) + u[i+2];
            i += 3;
            a.push(T.charAt(63 & (v >> 18)));
            a.push(T.charAt(63 & (v >> 12)));
            a.push(T.charAt(63 & (v >> 6)));
            a.push(T.charAt(63 & v));
        }
        if (2 == (u.length - i)) {
            var v = (u[i] << 16) + (u[i+1] << 8);
            a.push(T.charAt(63 & (v >> 18)));
            a.push(T.charAt(63 & (v >> 12)));
            a.push(T.charAt(63 & (v >> 6)));
            a.push('=');
        } else if (1 == (u.length - i)) {
            var v = (u[i] << 16);
            a.push(T.charAt(63 & (v >> 18)));
            a.push(T.charAt(63 & (v >> 12)));
            a.push('==');
        }
        return a.join('');
    }
    var R = (function(){
        var a = [];
        for (var i=0; i<T.length; ++i) {
            a[T.charCodeAt(i)] = i;
        }
        a['='.charCodeAt(0)] = 0;
        return a;
    })();
    var decodeArray = function(s) {
        var i = 0;
        var u = [];
        var n = 0 | (s.length / 4);
        while (0 < n--) {
            var v = (R[s.charCodeAt(i)] << 18) + (R[s.charCodeAt(i+1)] << 12) + (R[s.charCodeAt(i+2)] << 6) + R[s.charCodeAt(i+3)];
            u.push(255 & (v >> 16));
            u.push(255 & (v >> 8));
            u.push(255 & v);
            i += 4;
        }
        if (u) {
            if ('=' == s.charAt(i-2)) {
                u.pop();
                u.pop();
            } else if ('=' == s.charAt(i-1)) {
                u.pop();
            }
        }
        return u;
    }
    var ASCII = {};
    ASCII.encode = function(s) {
        var u = [];
        for (var i = 0; i<s.length; ++i) {
            u.push(s.charCodeAt(i));
        }
        return u;
    };
    ASCII.decode = function(u) {
        for (var i = 0; i<s.length; ++i) {
            a[i] = String.fromCharCode(a[i]);
        }
        return a.join('');
    };
    BASE64.decodeArray = function(s) {
        var u = decodeArray(s);
        return new Uint8Array(u);
    };
    BASE64.encodeASCII = function(s) {
        var u = ASCII.encode(s);
        return encodeArray(u);
    };
    BASE64.decodeASCII = function(s) {
        var a = decodeArray(s);
        return ASCII.decode(a);
    };
    BASE64.encode = function(s) {
        var u = UTF8.encode(s);
        return encodeArray(u);
    };
    BASE64.decode = function(s) {
        var u = decodeArray(s);
        return UTF8.decode(u);
    };
})("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");

if (undefined === btoa) {
    var btoa = BASE64.encode;
}
if (undefined === atob) {
    var atob = BASE64.decode;
}
;/**
 * @copyright The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * @license THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * @class MediaPlayer
 * @param aContext - New instance of a dijon.js context (i.e. new Dash.di.DashContext()).  You can pass a custom context that extends Dash.di.DashContext to override item(s) in the DashContext.
 */
/*jshint -W020 */
MediaPlayer = function (aContext) {

    "use strict";

/*
 * Initialization:
 *
 * 1) Check if MediaSource is available.
 * 2) Load manifest.
 * 3) Parse manifest.
 * 4) Check if Video Element can play codecs.
 * 5) Register MediaSource with Video Element.
 * 6) Create SourceBuffers.
 * 7) Do live stuff.
 *      a. Start manifest refresh.
 *      b. Calculate live point.
 *      c. Calculate offset between availabilityStartTime and initial video timestamp.
 * 8) Start buffer managers.
 *
 * Buffer Management:
 *
 * 1) Generate metrics.
 * 2) Check if fragments should be loaded.
 * 3) Check ABR for change in quality.
 * 4) Figure out which fragments to load.
 * 5) Load fragments.
 * 6) Transform fragments.
 * 7) Push fragmemt bytes into SourceBuffer.
 */
    var VERSION = "1.3.0 (refactor)",
        context = aContext,
        system,
        manifestLoader,
        abrController,
        element,
        source,
        protectionData = null,
        streamController,
        rulesController,
        manifestUpdater,
        protectionController,
        metricsExt,
        metricsModel,
        videoModel,
        initialized = false,
        playing = false,
        autoPlay = true,
        scheduleWhilePaused = false,
        bufferMax = MediaPlayer.dependencies.BufferController.BUFFER_SIZE_REQUIRED,

        isReady = function () {
            return (!!element && !!source);
        },

        play = function () {
            if (!initialized) {
                throw "MediaPlayer not initialized!";
            }

            if (!this.capabilities.supportsMediaSource()) {
                this.errHandler.capabilityError("mediasource");
                return;
            }

            if (!element || !source) {
                throw "Missing view or source.";
            }

            playing = true;
            //this.debug.log("Playback initiated!");
            streamController = system.getObject("streamController");
            streamController.subscribe(streamController.eventList.ENAME_STREAMS_COMPOSED, manifestUpdater);
            manifestLoader.subscribe(manifestLoader.eventList.ENAME_MANIFEST_LOADED, streamController);
            manifestLoader.subscribe(manifestLoader.eventList.ENAME_MANIFEST_LOADED, manifestUpdater);
            streamController.setVideoModel(videoModel);
            streamController.setAutoPlay(autoPlay);
            streamController.setProtectionData(protectionData);
            streamController.load(source);

            system.mapValue("scheduleWhilePaused", scheduleWhilePaused);
            system.mapOutlet("scheduleWhilePaused", "stream");
            system.mapOutlet("scheduleWhilePaused", "scheduleController");
            system.mapValue("bufferMax", bufferMax);
            system.mapOutlet("bufferMax", "bufferController");

            rulesController.initialize();
        },

        doAutoPlay = function () {
            if (isReady()) {
                play.call(this);
            }
        },

        getDVRInfoMetric = function() {
            var metric = metricsModel.getReadOnlyMetricsFor('video') || metricsModel.getReadOnlyMetricsFor('audio');
            return metricsExt.getCurrentDVRInfo(metric);
        },

        getDVRWindowSize = function() {
            return getDVRInfoMetric.call(this).manifestInfo.DVRWindowSize;
        },

        getDVRSeekOffset = function (value) {
            var metric = getDVRInfoMetric.call(this),
                val  = metric.range.start + value;

            if (val > metric.range.end) {
                val = metric.range.end;
            }

            return val;
        },

        seek = function(value) {

            videoModel.getElement().currentTime = this.getDVRSeekOffset(value);
        },

        time = function () {
            var metric = getDVRInfoMetric.call(this);
            return (metric === null) ? 0 : this.duration() - (metric.range.end - metric.time);
        },

        duration  = function () {
            var metric = getDVRInfoMetric.call(this),
                range;

            if (metric === null) {
                return 0;
            }

            range = metric.range.end - metric.range.start;

            return range < metric.manifestInfo.DVRWindowSize ? range : metric.manifestInfo.DVRWindowSize;
        },

        timeAsUTC = function () {
            var metric = getDVRInfoMetric.call(this),
                availableFrom,
                currentUTCTime;

            if (metric === null) {
                return 0;
            }

            availableFrom = metric.manifestInfo.availableFrom.getTime() / 1000;
            currentUTCTime = this.time() + (availableFrom + metric.range.start);

            return currentUTCTime;
        },

        durationAsUTC = function () {
            var metric = getDVRInfoMetric.call(this),
                availableFrom,
                currentUTCDuration;

            if (metric === null){
                return 0;
            }

            availableFrom = metric.manifestInfo.availableFrom.getTime() / 1000;
            currentUTCDuration = (availableFrom + metric.range.start) + this.duration();

            return currentUTCDuration;
        },

        formatUTC = function (time, locales, hour12) {
            var dt = new Date(time*1000);
            var d = dt.toLocaleDateString(locales);
            var t = dt.toLocaleTimeString(locales, {hour12:hour12});
            return t +' '+d;
        },

        convertToTimeCode = function (value) {
            value = Math.max(value, 0);

            var h = Math.floor(value/3600);
            var m = Math.floor((value%3600)/60);
            var s = Math.floor((value%3600)%60);
            return (h === 0 ? "":(h<10 ? "0"+h.toString()+":" : h.toString()+":"))+(m<10 ? "0"+m.toString() : m.toString())+":"+(s<10 ? "0"+s.toString() : s.toString());
        },

        updateRules = function(type, rules, override) {
            if (!rules || (type === undefined) || type === null) return;

            if (override) {
                rulesController.setRules(type, rules);
            } else {
                rulesController.addRules(type, rules);
            }
        },

        doReset = function() {
            if (playing && streamController) {
                streamController.unsubscribe(streamController.eventList.ENAME_STREAMS_COMPOSED, manifestUpdater);
                manifestLoader.unsubscribe(manifestLoader.eventList.ENAME_MANIFEST_LOADED, streamController);
                manifestLoader.unsubscribe(manifestLoader.eventList.ENAME_MANIFEST_LOADED, manifestUpdater);
                streamController.reset();
                abrController.reset();
                rulesController.reset();
                streamController = null;
                playing = false;
            }
        };

    // Set up DI.
    system = new dijon.System();
    system.mapValue("system", system);
    system.mapOutlet("system");
    system.injectInto(context);

    return {
        notifier: undefined,
        debug: undefined,
        eventBus: undefined,
        capabilities: undefined,
        adapter: undefined,
        errHandler: undefined,
        tokenAuthentication:undefined,
        uriQueryFragModel:undefined,
        videoElementExt:undefined,

        setup: function() {
            metricsExt = system.getObject("metricsExt");
            manifestLoader = system.getObject("manifestLoader");
            manifestUpdater = system.getObject("manifestUpdater");
            abrController = system.getObject("abrController");
            rulesController = system.getObject("rulesController");
            metricsModel = system.getObject("metricsModel");
            protectionController = system.getObject("protectionController");
        },

        /**
         *
         *
         * @param type
         * @param listener
         * @param useCapture
         * @memberof MediaPlayer#
         *
         */
        addEventListener: function (type, listener, useCapture) {
            this.eventBus.addEventListener(type, listener, useCapture);
        },

        /**
         * @param type
         * @param listener
         * @param useCapture
         * @memberof MediaPlayer#
         */
        removeEventListener: function (type, listener, useCapture) {
            this.eventBus.removeEventListener(type, listener, useCapture);
        },

        /**
         * @returns {string} the current dash.js version string.
         * @memberof MediaPlayer#
         */
        getVersion: function () {
            return VERSION;
        },

        /**
         * @memberof MediaPlayer#
         */
        startup: function () {
            if (!initialized) {
                system.injectInto(this);
                initialized = true;
            }
        },

        /**
         * Use this method to access the dash.js debugger.
         *
         * @returns {@link MediaPlayer.utils.Debug Debug.js (Singleton)}
         * @memberof MediaPlayer#
         */
        getDebug: function () {
            return this.debug;
        },

        /**
         * @returns {@link VideoModel}
         * @memberof MediaPlayer#
         */
        getVideoModel: function () {
            return videoModel;
        },

        /**
         * @param value
         * @memberof MediaPlayer#
         */
        setAutoPlay: function (value) {
            autoPlay = value;
        },

        /**
         * @returns {boolean} The current autoPlay state.
         * @memberof MediaPlayer#
         */
        getAutoPlay: function () {
            return autoPlay;
        },

        /**
         * @param value
         * @memberof MediaPlayer#
         */
        setScheduleWhilePaused: function(value) {
            scheduleWhilePaused = value;
        },

        /**
         * @returns {boolean}
         * @memberof MediaPlayer#
         */
        getScheduleWhilePaused: function() {
            return scheduleWhilePaused;
        },

        /**
         * @param name
         * @param type
         * @memberof MediaPlayer#
         */
        setTokenAuthentication:function(name, type) {
            this.tokenAuthentication.setTokenAuthentication({name:name, type:type});
        },

        /**
         * @param keySystem
         * @param value
         * @memberof MediaPlayer#
         */
        setBearerToken: function(keySystem, value) {
            protectionController.setBearerToken({keySystem: keySystem, token: value});
        },

        /**
         * @param value
         * @memberof MediaPlayer#
         */
        setBufferMax: function(value) {
            bufferMax = value;
        },

        /**
         * @returns {string}
         * @memberof MediaPlayer#
         */
        getBufferMax: function() {
            return bufferMax;
        },

        /**
         * @returns {object}
         * @memberof MediaPlayer#
         */
        getMetricsExt: function () {
            return metricsExt;
        },

        /**
         * @param type
         * @returns {object}
         * @memberof MediaPlayer#
         */
        getMetricsFor: function (type) {
            var metrics = metricsModel.getReadOnlyMetricsFor(type);
            return metrics;
        },

        /**
         * @param type
         * @returns {object}
         * @memberof MediaPlayer#
         */
        getQualityFor: function (type) {
            return abrController.getQualityFor(type, streamController.getActiveStreamInfo());
        },

        /**
         * @param type
         * @param value
         * @memberof MediaPlayer#
         */
        setQualityFor: function (type, value) {
            abrController.setPlaybackQuality(type, streamController.getActiveStreamInfo(), value);
        },

        /**
         * @returns {object}
         * @memberof MediaPlayer#
         */
        getAutoSwitchQuality : function () {
            return abrController.getAutoSwitchBitrate();
        },

        /**
         * @param value
         * @memberof MediaPlayer#
         */
        setAutoSwitchQuality : function (value) {
            abrController.setAutoSwitchBitrate(value);
        },

        /**
         * @param newRulesCollection
         * @memberof MediaPlayer#
         */
        setSchedulingRules: function(newRulesCollection) {
            updateRules.call(this, rulesController.SCHEDULING_RULE, newRulesCollection, true);
        },

        /**
         * @param newRulesCollection
         * @memberof MediaPlayer#
         */
        addSchedulingRules: function(newRulesCollection) {
            updateRules.call(this, rulesController.SCHEDULING_RULE, newRulesCollection, false);
        },

        /**
         * @param newRulesCollection
         * @memberof MediaPlayer#
         */
        setABRRules: function(newRulesCollection) {
            updateRules.call(this, rulesController.ABR_RULE, newRulesCollection, true);
        },

        /**
         * @param newRulesCollection
         * @memberof MediaPlayer#
         */
        addABRRules: function(newRulesCollection) {
            updateRules.call(this, rulesController.ABR_RULE, newRulesCollection, false);
        },

        /**
         * Use this method to attach an HTML5 VideoElement for dash.js to operate upon.
         *
         * @param {VideoElement} view An HTML5 VideoElement that has already defined in the DOM.
         *
         * @memberof MediaPlayer#
         */
        attachView: function (view) {
            if (!initialized) {
                throw "MediaPlayer not initialized!";
            }

            element = view;

            videoModel = null;
            if (element) {
                videoModel = system.getObject("videoModel");
                videoModel.setElement(element);
            }

            // TODO : update

            doReset.call(this);

            if (isReady.call(this)) {
                doAutoPlay.call(this);
            }
        },

        /**
         * Use this method to set a source URL to a valid MPD manifest file.
         *
         * @param {string} url A URL to a valid MPD manifest file.
         * @throw "MediaPlayer not initialized!"
         *
         * @memberof MediaPlayer#
         */
        attachSource: function (url) {
            if (!initialized) {
                throw "MediaPlayer not initialized!";
            }

            this.uriQueryFragModel.reset();
            source = this.uriQueryFragModel.parseURI(url);

            // TODO : update

            doReset.call(this);

            if (isReady.call(this)) {
                doAutoPlay.call(this);
            }
        },

        /**
         * Attach a specific url to use for License Acquisition with EME
         * @param url
         */
        attachProtectionData: function(data) {
            protectionData = data;
        },

        /**
         * Sets the MPD source and the video element to null.
         *
         * @memberof MediaPlayer#
         */
        reset: function() {
            this.attachSource(null);
            this.attachView(null);
        },

        /**
         * The play method initiates playback of the media defined by the {@link MediaPlayer#attachSource attachSource()} method.
         *
         * @see {@link MediaPlayer#attachSource attachSource()}
         *
         * @memberof MediaPlayer#
         * @method
         */
        play: play,

        /**
         * The ready state of the MediaPlayer based on both the video element and MPD source being defined.
         *
         * @returns {boolean} The current ready state of the MediaPlayer
         * @see {@link MediaPlayer#attachView attachView()}
         * @see {@link MediaPlayer#attachSource attachSource()}
         *
         * @memberof MediaPlayer#
         * @method
         */
        isReady: isReady,

        /**
         * Sets the currentTime property of the attached video element.  If it is a live stream with a
         * timeShiftBufferLength, then the DVR window offset will be automatically calculated.
         *
         * @param {number} value A relative time, in seconds, based on the return value of the {@link MediaPlayer#duration duration()} method is expected
         * @see {@link MediaPlayer#getDVRSeekOffset getDVRSeekOffset()}
         *
         * @memberof MediaPlayer#
         * @method
         */
        seek : seek,

        /**
         * Current time of the playhead, in seconds.
         *
         * @returns {number} Returns the current playhead time of the media.
         *
         * @memberof MediaPlayer#
         * @method
         */
        time : time,

        /**
         * Duration of the media's playback, in seconds.
         *
         * @returns {number} Returns the current duration of the media.
         *
         * @memberof MediaPlayer#
         * @method
         */
        duration : duration,

        /**
         * Use this method to get the current playhead time as an absolute value, the time in seconds since midnight UTC, Jan 1 1970.
         * Note - this property only has meaning for live streams
         *
         * @returns {number} Returns the current playhead time as UTC timestamp.
         *
         * @memberof MediaPlayer#
         * @method
         */
        timeAsUTC : timeAsUTC,

        /**
         * Use this method to get the current duration as an absolute value, the time in seconds since midnight UTC, Jan 1 1970.
         * Note - this property only has meaning for live streams.
         *
         * @returns {number} Returns the current duration as UTC timestamp.
         *
         * @memberof MediaPlayer#
         * @method
         */
        durationAsUTC : durationAsUTC,

        /**
         * The timeShiftBufferLength (DVR Window), in seconds.
         *
         * @returns {number} The window of allowable play time behind the live point of a live stream.
         *
         * @memberof MediaPlayer#
         * @method
         */
        getDVRWindowSize : getDVRWindowSize,

        /**
         * This method should only be used with a live stream that has a valid timeShiftBufferLength (DVR Window).
         * NOTE - If you do not need the raw offset value (i.e. media analytics, tracking, etc) consider using the {@link MediaPlayer#seek seek()} method
         * which will calculate this value for you and set the video element's currentTime property all in one simple call.
         *
         * @param {number} value A relative time, in seconds, based on the return value of the {@link MediaPlayer#duration duration()} method is expected.
         * @returns A value that is relative the available range within the timeShiftBufferLength (DVR Window).
         *
         * @see {@link MediaPlayer#seek seek()}
         *
         * @memberof MediaPlayer#
         * @method
         */
        getDVRSeekOffset : getDVRSeekOffset,

        /**
         * A utility methods which converts UTC timestamp value into a valid time and date string.
         *
         * @param {number} time - UTC timestamp to be converted into date and time.
         * @param {string} locales - a region identifier (i.e. en_US).
         * @param {boolean} hour12 - 12 vs 24 hour. Set to true for 12 hour time formatting.
         * @returns {string} a formatted time and date string.
         *
         * @memberof MediaPlayer#
         * @method
         */
        formatUTC : formatUTC,

        /**
         * A utility method which converts seconds into TimeCode (i.e. 300 --> 05:00).
         *
         * @param value - A number in seconds to be converted into a time code format.
         * @returns {string} A formatted time code string.
         *
         * @memberof MediaPlayer#
         * @method
         */
        convertToTimeCode : convertToTimeCode

    };
};

MediaPlayer.prototype = {
    constructor: MediaPlayer
};

MediaPlayer.dependencies = {};
MediaPlayer.utils = {};
MediaPlayer.models = {};
MediaPlayer.vo = {};
MediaPlayer.vo.metrics = {};
MediaPlayer.rules = {};
MediaPlayer.di = {};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.di.Context = function () {
    "use strict";

    return {
        system : undefined,
        setup : function () {
            this.system.autoMapOutlets = true;

            this.system.mapSingleton('debug', MediaPlayer.utils.Debug);
            this.system.mapSingleton('tokenAuthentication', MediaPlayer.utils.TokenAuthentication);
            this.system.mapSingleton('eventBus', MediaPlayer.utils.EventBus);
            this.system.mapSingleton('capabilities', MediaPlayer.utils.Capabilities);
            this.system.mapSingleton('textTrackExtensions', MediaPlayer.utils.TextTrackExtensions);
            this.system.mapSingleton('vttParser', MediaPlayer.utils.VTTParser);
            this.system.mapSingleton('ttmlParser', MediaPlayer.utils.TTMLParser);

            this.system.mapClass('videoModel', MediaPlayer.models.VideoModel);
            this.system.mapSingleton('manifestModel', MediaPlayer.models.ManifestModel);
            this.system.mapSingleton('metricsModel', MediaPlayer.models.MetricsModel);
            this.system.mapSingleton('uriQueryFragModel', MediaPlayer.models.URIQueryAndFragmentModel);
            this.system.mapClass('protectionModel', MediaPlayer.models.ProtectionModel);

            this.system.mapSingleton('textSourceBuffer', MediaPlayer.dependencies.TextSourceBuffer);
            this.system.mapSingleton('mediaSourceExt', MediaPlayer.dependencies.MediaSourceExtensions);
            this.system.mapSingleton('sourceBufferExt', MediaPlayer.dependencies.SourceBufferExtensions);
            this.system.mapSingleton('abrController', MediaPlayer.dependencies.AbrController);
            this.system.mapSingleton('errHandler', MediaPlayer.dependencies.ErrorHandler);
            this.system.mapSingleton('protectionExt', MediaPlayer.dependencies.ProtectionExtensions);
            this.system.mapSingleton('videoExt', MediaPlayer.dependencies.VideoModelExtensions);
            this.system.mapSingleton('protectionController', MediaPlayer.dependencies.ProtectionController);
            this.system.mapClass('playbackController', MediaPlayer.dependencies.PlaybackController);

            this.system.mapSingleton('liveEdgeFinder', MediaPlayer.dependencies.LiveEdgeFinder);

            this.system.mapClass('metrics', MediaPlayer.models.MetricsList);
            this.system.mapClass('downloadRatioRule', MediaPlayer.rules.DownloadRatioRule);
            this.system.mapClass('insufficientBufferRule', MediaPlayer.rules.InsufficientBufferRule);
            this.system.mapClass('limitSwitchesRule', MediaPlayer.rules.LimitSwitchesRule);
            this.system.mapSingleton('abrRulesCollection', MediaPlayer.rules.ABRRulesCollection);

            this.system.mapSingleton('rulesController', MediaPlayer.rules.RulesController);
            this.system.mapClass('liveEdgeBinarySearchRule', MediaPlayer.rules.LiveEdgeBinarySearchRule);
            this.system.mapClass('bufferLevelRule', MediaPlayer.rules.BufferLevelRule);
            this.system.mapClass('pendingRequestsRule', MediaPlayer.rules.PendingRequestsRule);
            this.system.mapClass('playbackTimeRule', MediaPlayer.rules.PlaybackTimeRule);
            this.system.mapClass('sameTimeRequestRule', MediaPlayer.rules.SameTimeRequestRule);
            this.system.mapSingleton('scheduleRulesCollection', MediaPlayer.rules.ScheduleRulesCollection);

            this.system.mapClass('streamProcessor', MediaPlayer.dependencies.StreamProcessor);
			this.system.mapClass('eventController', MediaPlayer.dependencies.EventController);
            this.system.mapClass('textController', MediaPlayer.dependencies.TextController);
            this.system.mapClass('bufferController', MediaPlayer.dependencies.BufferController);
            this.system.mapSingleton('manifestLoader', MediaPlayer.dependencies.ManifestLoader);
            this.system.mapSingleton('manifestUpdater', MediaPlayer.dependencies.ManifestUpdater);
            this.system.mapClass('fragmentController', MediaPlayer.dependencies.FragmentController);
            this.system.mapClass('fragmentLoader', MediaPlayer.dependencies.FragmentLoader);
            this.system.mapClass('fragmentModel', MediaPlayer.dependencies.FragmentModel);
            this.system.mapSingleton('streamController', MediaPlayer.dependencies.StreamController);
            this.system.mapClass('stream', MediaPlayer.dependencies.Stream);
            this.system.mapClass('scheduleController', MediaPlayer.dependencies.ScheduleController);

            this.system.mapSingleton('notifier', MediaPlayer.dependencies.Notifier);
        }
    };
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/*jshint -W020 */
Dash = (function () {
    "use strict";

    return {
        modules: {},
        dependencies: {},
        vo: {},
        di: {}
    };
}());;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.di.DashContext = function () {
    "use strict";

    return {
        system : undefined,
        setup : function () {
            Dash.di.DashContext.prototype.setup.call(this);

            this.system.mapClass('parser', Dash.dependencies.DashParser);
            this.system.mapClass('indexHandler', Dash.dependencies.DashHandler);
            this.system.mapSingleton('baseURLExt', Dash.dependencies.BaseURLExtensions);
            this.system.mapClass('fragmentExt', Dash.dependencies.FragmentExtensions);
            this.system.mapClass('trackController', Dash.dependencies.RepresentationController);
            this.system.mapSingleton('manifestExt', Dash.dependencies.DashManifestExtensions);
            this.system.mapSingleton('metricsExt', Dash.dependencies.DashMetricsExtensions);
            this.system.mapSingleton('timelineConverter', Dash.dependencies.TimelineConverter);
            this.system.mapSingleton('adapter', Dash.dependencies.DashAdapter);
        }
    };
};

Dash.di.DashContext.prototype = new MediaPlayer.di.Context();
Dash.di.DashContext.prototype.constructor = Dash.di.DashContext;
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.dependencies.BaseURLExtensions = function () {
    "use strict";

        // From YouTube player.  Reformatted for JSLint.
    var parseSIDX = function (ab, ab_first_byte_offset) {
            var d = new DataView(ab),
                sidx = {},
                pos = 0,
                offset,
                time,
                sidxEnd,
                i,
                ref_type,
                ref_size,
                ref_dur,
                type,
                size,
                charCode;

            while (type !== "sidx" && pos < d.byteLength) {
                size = d.getUint32(pos); // subtract 8 for including the size and type
                pos += 4;

                type = "";
                for (i = 0; i < 4; i += 1) {
                    charCode = d.getInt8(pos);
                    type += String.fromCharCode(charCode);
                    pos += 1;
                }

                if (type !== "moof" && type !== "traf" && type !== "sidx") {
                    pos += size - 8;
                } else if (type === "sidx") {
                    // reset the position to the beginning of the box...
                    // if we do not reset the position, the evaluation
                    // of sidxEnd to ab.byteLength will fail.
                    pos -= 8;
                }
            }

            sidxEnd = d.getUint32(pos, false) + pos;
            if (sidxEnd > ab.byteLength) {
                throw "sidx terminates after array buffer";
            }

            sidx.version = d.getUint8(pos + 8);
            pos += 12;

            // skipped reference_ID(32)
            sidx.timescale = d.getUint32(pos + 4, false);
            pos += 8;

            if (sidx.version === 0) {
                sidx.earliest_presentation_time = d.getUint32(pos, false);
                sidx.first_offset = d.getUint32(pos + 4, false);
                pos += 8;
            } else {
                // TODO(strobe): Overflow checks
                sidx.earliest_presentation_time = utils.Math.to64BitNumber(d.getUint32(pos + 4, false), d.getUint32(pos, false));
                //first_offset = utils.Math.to64BitNumber(d.getUint32(pos + 8, false), d.getUint32(pos + 12, false));
                sidx.first_offset = (d.getUint32(pos + 8, false) << 32) + d.getUint32(pos + 12, false);
                pos += 16;
            }

            sidx.first_offset += sidxEnd + (ab_first_byte_offset || 0);

            // skipped reserved(16)
            sidx.reference_count = d.getUint16(pos + 2, false);
            pos += 4;

            sidx.references = [];
            offset = sidx.first_offset;
            time = sidx.earliest_presentation_time;

            for (i = 0; i < sidx.reference_count; i += 1) {
                ref_size = d.getUint32(pos, false);
                ref_type = (ref_size >>> 31);
                ref_size = ref_size & 0x7fffffff;
                ref_dur = d.getUint32(pos + 4, false);
                pos += 12;
                sidx.references.push({
                    'size': ref_size,
                    'type': ref_type,
                    'offset': offset,
                    'duration': ref_dur,
                    'time': time,
                    'timescale': sidx.timescale
                });
                offset += ref_size;
                time += ref_dur;
            }

            if (pos !== sidxEnd) {
                throw "Error: final pos " + pos + " differs from SIDX end " + sidxEnd;
            }

            return sidx;
        },

        parseSegments = function (data, media, offset) {
            var parsed,
                ref,
                segments,
                segment,
                i,
                len,
                start,
                end;

            parsed = parseSIDX.call(this, data, offset);
            ref = parsed.references;
            segments = [];

            for (i = 0, len = ref.length; i < len; i += 1) {
                segment = new Dash.vo.Segment();
                segment.duration = ref[i].duration;
                segment.media = media;
                segment.startTime = ref[i].time;
                segment.timescale = ref[i].timescale;

                start = ref[i].offset;
                end = ref[i].offset + ref[i].size - 1;
                segment.mediaRange = start + "-" + end;

                segments.push(segment);
            }

            this.debug.log("Parsed SIDX box: " + segments.length + " segments.");
            return segments;
        },

        findInit = function (data, info, callback) {
            var ftyp,
                moov,
                start,
                end,
                d = new DataView(data),
                pos = 0,
                type = "",
                size = 0,
                bytesAvailable,
                i,
                c,
                request,
                loaded = false,
                irange,
                self = this;

            self.debug.log("Searching for initialization.");

            while (type !== "moov" && pos < d.byteLength) {
                size = d.getUint32(pos); // subtract 8 for including the size and type
                pos += 4;

                type = "";
                for (i = 0; i < 4; i += 1) {
                    c = d.getInt8(pos);
                    type += String.fromCharCode(c);
                    pos += 1;
                }

                if (type === "ftyp") {
                    ftyp = pos - 8;
                }
                if (type === "moov") {
                    moov = pos - 8;
                }
                if (type !== "moov") {
                    pos += size - 8;
                }
            }

            bytesAvailable = d.byteLength - pos;

            if (type !== "moov") {
                // Case 1
                // We didn't download enough bytes to find the moov.
                // TODO : Load more bytes.
                //        Be sure to detect EOF.
                //        Throw error is no moov is found in the entire file.
                //        Protection from loading the entire file?
                self.debug.log("Loading more bytes to find initialization.");
                info.range.start = 0;
                info.range.end = info.bytesLoaded + info.bytesToLoad;

                request = new XMLHttpRequest();

                request.onloadend = function () {
                    if (!loaded) {
                        callback.call(self, null, new Error("Error loading initialization."));
                    }
                };

                request.onload = function () {
                    loaded = true;
                    info.bytesLoaded = info.range.end;
                    findInit.call(self, request.response, function (segments) {
                        callback.call(self, segments);
                    });
                };

                request.onerror = function () {
                    callback.call(self, null, new Error("Error loading initialization."));
                };

                request.open("GET", self.tokenAuthentication.addTokenAsQueryArg(info.url));
                request.responseType = "arraybuffer";
                request.setRequestHeader("Range", "bytes=" + info.range.start + "-" + info.range.end);
                request = self.tokenAuthentication.setTokenInRequestHeader(request);
                request.send(null);
            } else {
                // Case 2
                // We have the entire range, so continue.
                start = ftyp === undefined ? moov : ftyp;
                end = moov + size - 1;
                irange = start + "-" + end;

                self.debug.log("Found the initialization.  Range: " + irange);
                callback.call(self, irange);
            }
        },

        loadInit = function (representation) {
            var request = new XMLHttpRequest(),
                needFailureReport = true,
                self = this,
                media = representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].
                    AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].BaseURL,
                info = {
                    url: media,
                    range: {},
                    searching: false,
                    bytesLoaded: 0,
                    bytesToLoad: 1500,
                    request: request
                };

            self.debug.log("Start searching for initialization.");
            info.range.start = 0;
            info.range.end = info.bytesToLoad;

            request.onload = function () {
                if (request.status < 200 || request.status > 299)
                {
                  return;
                }
                needFailureReport = false;

                info.bytesLoaded = info.range.end;
                findInit.call(self, request.response, info, function (range) {
                    representation.range = range;
                    representation.initialization = media;
                    self.notify(self.eventList.ENAME_INITIALIZATION_LOADED, representation);
                });
            };

            request.onloadend = request.onerror = function () {
                if (!needFailureReport)
                {
                  return;
                }
                needFailureReport = false;

                self.errHandler.downloadError("initialization", info.url, request);
                self.notify(self.eventList.ENAME_INITIALIZATION_LOADED, representation);
            };

            request.open("GET", self.tokenAuthentication.addTokenAsQueryArg(info.url));
            request.responseType = "arraybuffer";
            request.setRequestHeader("Range", "bytes=" + info.range.start + "-" + info.range.end);
            request = self.tokenAuthentication.setTokenInRequestHeader(request);
            request.send(null);
            self.debug.log("Perform init search: " + info.url);
        },

        findSIDX = function (data, info, representation, callback) {
            var segments,
                d = new DataView(data),
                request = new XMLHttpRequest(),
                pos = 0,
                type = "",
                size = 0,
                bytesAvailable,
                sidxBytes,
                sidxSlice,
                sidxOut,
                i,
                c,
                needFailureReport = true,
                parsed,
                ref,
                loadMultiSidx = false,
                self = this;

            self.debug.log("Searching for SIDX box.");
            self.debug.log(info.bytesLoaded + " bytes loaded.");

            while (type !== "sidx" && pos < d.byteLength) {
                size = d.getUint32(pos); // subtract 8 for including the size and type
                pos += 4;

                type = "";
                for (i = 0; i < 4; i += 1) {
                    c = d.getInt8(pos);
                    type += String.fromCharCode(c);
                    pos += 1;
                }

                if (type !== "sidx") {
                    pos += size - 8;
                }
            }

            bytesAvailable = d.byteLength - pos;

            if (type !== "sidx") {
                // Case 1
                // We didn't download enough bytes to find the sidx.
                // TODO : Load more bytes.
                //        Be sure to detect EOF.
                //        Throw error is no sidx is found in the entire file.
                //        Protection from loading the entire file?
                callback.call(self);
            } else if (bytesAvailable < (size - 8)) {
                // Case 2
                // We don't have the entire box.
                // Increase the number of bytes to read and load again.
                self.debug.log("Found SIDX but we don't have all of it.");

                info.range.start = 0;
                info.range.end = info.bytesLoaded + (size - bytesAvailable);

                request.onload = function () {
                    if (request.status < 200 || request.status > 299)
                    {
                      return;
                    }
                    needFailureReport = false;

                    info.bytesLoaded = info.range.end;
                    findSIDX.call(self, request.response, info, representation, callback);
                };

                request.onloadend = request.onerror = function () {
                    if (!needFailureReport)
                    {
                      return;
                    }
                    needFailureReport = false;

                    self.errHandler.downloadError("SIDX", info.url, request);
                    callback.call(self);
                };

                request.open("GET", self.tokenAuthentication.addTokenAsQueryArg(info.url));
                request.responseType = "arraybuffer";
                request.setRequestHeader("Range", "bytes=" + info.range.start + "-" + info.range.end);
                request = self.tokenAuthentication.setTokenInRequestHeader(request);
                request.send(null);
            } else {
                // Case 3
                // We have the entire box, so parse it and continue.
                info.range.start = pos - 8;
                info.range.end = info.range.start + size;

                self.debug.log("Found the SIDX box.  Start: " + info.range.start + " | End: " + info.range.end);
//                sidxBytes = data.slice(info.range.start, info.range.end);
                sidxBytes = new ArrayBuffer(info.range.end - info.range.start);
                sidxOut = new Uint8Array(sidxBytes);
                sidxSlice = new Uint8Array(data, info.range.start, info.range.end - info.range.start);
                sidxOut.set(sidxSlice);

                parsed = this.parseSIDX.call(this, sidxBytes, info.range.start);

                // We need to check to see if we are loading multiple sidx.
                // For now just check the first reference and assume they are all the same.
                // TODO : Can the referenceTypes be mixed?
                // TODO : Load them all now, or do it as needed?

                ref = parsed.references;
                if (ref !== null && ref !== undefined && ref.length > 0) {
                    loadMultiSidx = (ref[0].type === 1);
                }

                if (loadMultiSidx) {
                    self.debug.log("Initiate multiple SIDX load.");

                    var j, len, ss, se, r, segs = [],
                        count = 0,
                        tmpCallback = function(segments) {
                            if (segments) {
                                segs = segs.concat(segments);
                                count += 1;

                                if (count >= len) {
                                    callback.call(self, segs);
                                }
                            } else {
                                callback.call(self);
                            }
                        };

                    for (j = 0, len = ref.length; j < len; j += 1) {
                        ss = ref[j].offset;
                        se = ref[j].offset + ref[j].size - 1;
                        r = ss + "-" + se;

                        loadSegments.call(self, representation, null, r, tmpCallback);
                    }

                } else {
                    self.debug.log("Parsing segments from SIDX.");
                    segments = parseSegments.call(self, sidxBytes, info.url, info.range.start);
                    callback.call(self, segments);
                }
            }
        },

        loadSegments = function (representation, type, theRange, callback) {
            var request = new XMLHttpRequest(),
                segments,
                parts,
                media = representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].
                    AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].BaseURL,
                needFailureReport = true,
                self = this,
                info = {
                    url: media,
                    range: {},
                    searching: false,
                    bytesLoaded: 0,
                    bytesToLoad: 1500,
                    request: request
                };

            // We might not know exactly where the sidx box is.
            // Load the first n bytes (say 1500) and look for it.
            if (theRange === null) {
                self.debug.log("No known range for SIDX request.");
                info.searching = true;
                info.range.start = 0;
                info.range.end = info.bytesToLoad;
            } else {
                parts = theRange.split("-");
                info.range.start = parseFloat(parts[0]);
                info.range.end = parseFloat(parts[1]);
            }

            request.onload = function () {
                if (request.status < 200 || request.status > 299)
                {
                  return;
                }
                needFailureReport = false;

                // If we didn't know where the SIDX box was, we have to look for it.
                // Iterate over the data checking out the boxes to find it.
                if (info.searching) {
                    info.bytesLoaded = info.range.end;
                    findSIDX.call(self, request.response, info, representation, function (segments) {
                        if (segments) {
                            callback.call(self, segments, representation, type);
                        }
                    });
                } else {
                    segments = parseSegments.call(self, request.response, info.url, info.range.start);
                    callback.call(self, segments, representation, type);
                }
            };

            request.onloadend = request.onerror = function () {
                if (!needFailureReport)
                {
                  return;
                }
                needFailureReport = false;

                self.errHandler.downloadError("SIDX", info.url, request);
                callback.call(self, null, representation, type);
            };

            request.open("GET", self.tokenAuthentication.addTokenAsQueryArg(info.url));
            request.responseType = "arraybuffer";
            request.setRequestHeader("Range", "bytes=" + info.range.start + "-" + info.range.end);
            request = self.tokenAuthentication.setTokenInRequestHeader(request);
            request.send(null);
            self.debug.log("Perform SIDX load: " + info.url);
        },

        onLoaded = function(segments, representation, type) {
            var self = this;

            if( segments) {
                self.notify(self.eventList.ENAME_SEGMENTS_LOADED, segments, representation, type);
            } else {
                self.notify(self.eventList.ENAME_SEGMENTS_LOADED, null, representation, type, new Error("error loading segments"));
            }
        };

    return {
        debug: undefined,
        errHandler: undefined,
        tokenAuthentication:undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_INITIALIZATION_LOADED: "initializationLoaded",
            ENAME_SEGMENTS_LOADED: "segmentsLoaded"
        },

        loadSegments: function(representation, type, range) {
            loadSegments.call(this, representation, type, range, onLoaded.bind(this));
        },

        loadInitialization: loadInit,
        parseSegments: parseSegments,
        parseSIDX: parseSIDX,
        findSIDX: findSIDX
    };
};

Dash.dependencies.BaseURLExtensions.prototype = {
    constructor: Dash.dependencies.BaseURLExtensions
};;Dash.dependencies.DashAdapter = function () {
    "use strict";
    var periods = [],
        adaptations = {},

        getRepresentationForTrackInfo = function(trackInfo, representationController) {
            return representationController.getRepresentationForQuality(trackInfo.quality);
        },

        getAdaptationForMediaInfo = function(mediaInfo) {
            return adaptations[mediaInfo.streamInfo.id][mediaInfo.index];
        },

        getPeriodForStreamInfo = function(streamInfo) {
            var period,
                ln = periods.length,
                i = 0;

            for (i; i < ln; i += 1) {
                period = periods[i];

                if (streamInfo.id === period.id) return period;
            }

            return null;
        },

        convertRepresentationToTrackInfo = function(representation) {
            var trackInfo = new MediaPlayer.vo.TrackInfo(),
                a = representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].AdaptationSet_asArray[representation.adaptation.index],
                r = this.manifestExt.getRepresentationFor(representation.index, a);

            trackInfo.id = representation.id;
            trackInfo.quality = representation.index;
            trackInfo.bandwidth = this.manifestExt.getBandwidth(r);
            trackInfo.DVRWindow = representation.segmentAvailabilityRange;
            trackInfo.fragmentDuration = representation.segmentDuration || (representation.segments && representation.segments.length > 0 ? representation.segments[0].duration : NaN);
            trackInfo.MSETimeOffset = representation.MSETimeOffset;
            trackInfo.useCalculatedLiveEdgeTime = representation.useCalculatedLiveEdgeTime;
            trackInfo.mediaInfo = convertAdaptationToMediaInfo.call(this, representation.adaptation);

            return trackInfo;
        },

        convertAdaptationToMediaInfo = function(adaptation) {
            var mediaInfo = new MediaPlayer.vo.MediaInfo(),
                self = this,
                a = adaptation.period.mpd.manifest.Period_asArray[adaptation.period.index].AdaptationSet_asArray[adaptation.index];

            mediaInfo.id = adaptation.id;
            mediaInfo.index = adaptation.index;
            mediaInfo.type = adaptation.type;
            mediaInfo.streamInfo = convertPeriodToStreamInfo.call(this, adaptation.period);
            mediaInfo.trackCount = this.manifestExt.getRepresentationCount(a);
            mediaInfo.lang = this.manifestExt.getLanguageForAdaptation(a);
            mediaInfo.codec = this.manifestExt.getCodec(a);
            mediaInfo.mimeType = this.manifestExt.getMimeType(a);
            mediaInfo.contentProtection = this.manifestExt.getContentProtectionData(a);

            if (mediaInfo.contentProtection) {
                mediaInfo.contentProtection.forEach(function(item){
                    item.KID = self.manifestExt.getKID(item);
                });
            }

            mediaInfo.isText = this.manifestExt.getIsTextTrack(mediaInfo.mimeType);

            return mediaInfo;
        },

        convertPeriodToStreamInfo = function(period) {
            var streamInfo = new MediaPlayer.vo.StreamInfo(),
                THRESHOLD = 1;

            streamInfo.id = period.id;
            streamInfo.index = period.index;
            streamInfo.start = period.start;
            streamInfo.duration = period.duration;
            streamInfo.manifestInfo = convertMpdToManifestInfo.call(this, period.mpd);
            streamInfo.isLast = Math.abs((streamInfo.start + streamInfo.duration) - streamInfo.manifestInfo.duration) < THRESHOLD;

            return streamInfo;
        },

        convertMpdToManifestInfo = function(mpd) {
            var manifestInfo = new MediaPlayer.vo.ManifestInfo(),
                manifest = this.manifestModel.getValue();

            manifestInfo.DVRWindowSize = mpd.timeShiftBufferDepth;
            manifestInfo.loadedTime = mpd.manifest.loadedTime;
            manifestInfo.availableFrom = mpd.availabilityStartTime;
            manifestInfo.minBufferTime = mpd.manifest.minBufferTime;
            manifestInfo.maxFragmentDuration = mpd.maxSegmentDuration;
            manifestInfo.duration = this.manifestExt.getDuration(manifest);
            manifestInfo.isDynamic = this.manifestExt.getIsDynamic(manifest);

            return manifestInfo;
        },

        getMediaInfoForType = function(manifest, streamInfo, type) {
            var periodInfo = getPeriodForStreamInfo(streamInfo),
                periodId = periodInfo.id,
                data = this.manifestExt.getAdaptationForType(manifest, streamInfo.index, type),
                idx;

            if (!data) return null;

            idx = this.manifestExt.getIndexForAdaptation(data, manifest, streamInfo.index);

            adaptations[periodId] = adaptations[periodId] || this.manifestExt.getAdaptationsForPeriod(manifest, periodInfo);

            return convertAdaptationToMediaInfo.call(this, adaptations[periodId][idx]);
        },

        getStreamsInfoFromManifest = function(manifest) {
            var mpd,
                streams = [],
                ln,
                i;

            if (!manifest) return null;

            mpd = this.manifestExt.getMpd(manifest);
            periods = this.manifestExt.getRegularPeriods(manifest, mpd);
            adaptations = {};
            ln = periods.length;

            for(i = 0; i < ln; i += 1) {
                streams.push(convertPeriodToStreamInfo.call(this, periods[i]));
            }

            return streams;
        },

        getMpdInfo = function(manifest) {
            var mpd = this.manifestExt.getMpd(manifest);

            return convertMpdToManifestInfo.call(this, mpd);
        },

        getInitRequest = function(streamProcessor, quality) {
            var representation = streamProcessor.trackController.getRepresentationForQuality(quality);

            return streamProcessor.indexHandler.getInitRequest(representation);
        },

        getNextFragmentRequest = function(streamProcessor, trackInfo) {
            var representation = getRepresentationForTrackInfo(trackInfo, streamProcessor.trackController);

            return streamProcessor.indexHandler.getNextSegmentRequest(representation);
        },

        getFragmentRequestForTime = function(streamProcessor, trackInfo, time, keepIdx) {
            var representation = getRepresentationForTrackInfo(trackInfo, streamProcessor.trackController);

            return streamProcessor.indexHandler.getSegmentRequestForTime(representation, time, keepIdx);
        },

        generateFragmentRequestForTime = function(streamProcessor, trackInfo, time) {
            var representation = getRepresentationForTrackInfo(trackInfo, streamProcessor.trackController),
                request = streamProcessor.indexHandler.generateSegmentRequestForTime(representation, time);

            return request;
        },

        getIndexHandlerTime = function(streamProcessor) {
            return streamProcessor.indexHandler.getCurrentTime();
        },

        setIndexHandlerTime = function(streamProcessor, value) {
            return streamProcessor.indexHandler.setCurrentTime(value);
        },

        updateData = function(streamProcessor) {
            var periodInfo = getPeriodForStreamInfo(streamProcessor.getStreamInfo()),
                mediaInfo = streamProcessor.getMediaInfo(),
                adaptation = getAdaptationForMediaInfo(mediaInfo),
                manifest = this.manifestModel.getValue(),
                type = streamProcessor.getType(),
                id,
                data;

            id = mediaInfo.id;
            data = id ? this.manifestExt.getAdaptationForId(id, manifest, periodInfo.index) : this.manifestExt.getAdaptationForIndex(mediaInfo.index, manifest, periodInfo.index);
            streamProcessor.setMediaInfo(mediaInfo);
            streamProcessor.trackController.updateData(data, adaptation, type);
        },

        getTrackInfoForQuality = function(representationController, quality) {
            var representation = representationController.getRepresentationForQuality(quality);

            return representation ? convertRepresentationToTrackInfo.call(this, representation) : null;
        },

        getCurrentTrackInfo = function(representationController) {
            var representation = representationController.getCurrentRepresentation();

            return representation ? convertRepresentationToTrackInfo.call(this, representation): null;
        },

        getEvent = function(eventBox, eventStreams, startTime) {
            var event = new Dash.vo.Event(),
                schemeIdUri = eventBox[0],
                value = eventBox[1],
                timescale = eventBox[2],
                presentationTimeDelta = eventBox[3],
                duration = eventBox[4],
                id = eventBox[5],
                messageData = eventBox[6],
                presentationTime = startTime*timescale+presentationTimeDelta;

            if (!eventStreams[schemeIdUri]) return null;

            event.eventStream = eventStreams[schemeIdUri];
            event.eventStream.value = value;
            event.eventStream.timescale = timescale;
            event.duration = duration;
            event.id = id;
            event.presentationTime = presentationTime;
            event.messageData = messageData;
            event.presentationTimeDelta = presentationTimeDelta;

            return event;
        },

        getEventsFor = function(info, streamProcessor) {
            var manifest = this.manifestModel.getValue(),
                events = [];

            if (info instanceof MediaPlayer.vo.StreamInfo) {
                events = this.manifestExt.getEventsForPeriod(manifest, getPeriodForStreamInfo(info));
            } else if (info instanceof MediaPlayer.vo.MediaInfo) {
                events = this.manifestExt.getEventStreamForAdaptationSet(manifest, getAdaptationForMediaInfo(info));
            } else if (info instanceof MediaPlayer.vo.TrackInfo) {
                events = this.manifestExt.getEventStreamForRepresentation(manifest, getRepresentationForTrackInfo(info, streamProcessor.trackController));
            }

            return events;
        };

    return {
        system : undefined,
        manifestExt: undefined,
        manifestModel: undefined,
        timelineConverter: undefined,

        metricsList: {
            TCP_CONNECTION: "TcpConnection",
            HTTP_REQUEST: "HttpRequest",
            HTTP_REQUEST_TRACE: "HttpRequestTrace",
            TRACK_SWITCH : "RepresentationSwitch",
            BUFFER_LEVEL: "BufferLevel",
            DVR_INFO: "DVRInfo",
            DROPPED_FRAMES: "DroppedFrames",
            SCHEDULING_INFO: "SchedulingInfo",
            MANIFEST_UPDATE: "ManifestUpdate",
            MANIFEST_UPDATE_STREAM_INFO: "ManifestUpdatePeriodInfo",
            MANIFEST_UPDATE_TRACK_INFO: "ManifestUpdateRepresentationInfo",
            PLAY_LIST: "PlayList",
            PLAY_LIST_TRACE: "PlayListTrace"
        },

        convertDataToTrack: convertRepresentationToTrackInfo,
        convertDataToMedia: convertAdaptationToMediaInfo,
        convertDataToStream: convertPeriodToStreamInfo,
        getDataForTrack: getRepresentationForTrackInfo,
        getDataForMedia: getAdaptationForMediaInfo,
        getDataForStream: getPeriodForStreamInfo,

        getStreamsInfo: getStreamsInfoFromManifest,
        getManifestInfo: getMpdInfo,
        getMediaInfoForType: getMediaInfoForType,

        getCurrentTrackInfo: getCurrentTrackInfo,
        getTrackInfoForQuality: getTrackInfoForQuality,
        updateData: updateData,

        getInitRequest: getInitRequest,
        getNextFragmentRequest: getNextFragmentRequest,
        getFragmentRequestForTime: getFragmentRequestForTime,
        generateFragmentRequestForTime: generateFragmentRequestForTime,
        getIndexHandlerTime: getIndexHandlerTime,
        setIndexHandlerTime: setIndexHandlerTime,

        getEventsFor: getEventsFor,
        getEvent: getEvent,

        reset: function(){
            periods = [];
            adaptations = {};
        }
    };
};

Dash.dependencies.DashAdapter.prototype = {
    constructor: Dash.dependencies.DashAdapter
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.dependencies.DashHandler = function () {
    "use strict";

    var index = -1,
        requestedTime,
        isDynamic,
        type,
        currentTime = 0,

        zeroPadToLength = function (numStr, minStrLength) {
            while (numStr.length < minStrLength) {
                numStr = "0" + numStr;
            }

            return numStr;
        },

        replaceTokenForTemplate = function (url, token, value) {

            var startPos = 0,
                endPos = 0,
                tokenLen = token.length,
                formatTag = "%0",
                formatTagLen = formatTag.length,
                formatTagPos,
                specifier,
                width,
                paddedValue;

            // keep looping round until all instances of <token> have been
            // replaced. once that has happened, startPos below will be -1
            // and the completed url will be returned.
            while (true) {

                // check if there is a valid $<token>...$ identifier
                // if not, return the url as is.
                startPos = url.indexOf("$" + token);
                if (startPos < 0) {
                    return url;
                }

                // the next '$' must be the end of the identifer
                // if there isn't one, return the url as is.
                endPos = url.indexOf("$", startPos + tokenLen);
                if (endPos < 0) {
                    return url;
                }

                // now see if there is an additional format tag suffixed to
                // the identifier within the enclosing '$' characters
                formatTagPos = url.indexOf(formatTag, startPos + tokenLen);
                if (formatTagPos > startPos && formatTagPos < endPos) {

                    specifier = url.charAt(endPos - 1);
                    width = parseInt(url.substring(formatTagPos + formatTagLen, endPos - 1), 10);

                    // support the minimum specifiers required by IEEE 1003.1
                    // (d, i , o, u, x, and X) for completeness
                    switch (specifier) {
                    // treat all int types as uint,
                    // hence deliberate fallthrough
                    case 'd':
                    case 'i':
                    case 'u':
                        paddedValue = zeroPadToLength(value.toString(), width);
                        break;
                    case 'x':
                        paddedValue = zeroPadToLength(value.toString(16), width);
                        break;
                    case 'X':
                        paddedValue = zeroPadToLength(value.toString(16), width).toUpperCase();
                        break;
                    case 'o':
                        paddedValue = zeroPadToLength(value.toString(8), width);
                        break;
                    default:
                        this.debug.log("Unsupported/invalid IEEE 1003.1 format identifier string in URL");
                        return url;
                    }
                } else {
                    paddedValue = value;
                }

                url = url.substring(0, startPos) + paddedValue + url.substring(endPos + 1);
            }
        },

        unescapeDollarsInTemplate = function (url) {
            return url.split("$$").join("$");
        },

        replaceIDForTemplate = function (url, value) {
            if (value === null || url.indexOf("$RepresentationID$") === -1) { return url; }
            var v = value.toString();
            return url.split("$RepresentationID$").join(v);
        },

        getNumberForSegment = function(segment, segmentIndex) {
            return segment.representation.startNumber + segmentIndex;
        },

        getRequestUrl = function (destination, representation) {
            var baseURL = representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].
                    AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].BaseURL,
                url;

            if (destination === baseURL) {
                url = destination;
            } else if (destination.indexOf("http://") !== -1) {
                url = destination;
            } else {
                url = baseURL + destination;
            }

            return url;
        },

        generateInitRequest = function(representation, mediaType) {
            var self = this,
                period,
                request = new MediaPlayer.vo.FragmentRequest(),
                presentationStartTime;

            period = representation.adaptation.period;

            request.mediaType = mediaType;
            request.type = "Initialization Segment";
            request.url = getRequestUrl(representation.initialization, representation);
            request.range = representation.range;
            presentationStartTime = period.start;
            request.availabilityStartTime = self.timelineConverter.calcAvailabilityStartTimeFromPresentationTime(presentationStartTime, representation.adaptation.period.mpd, isDynamic);
            request.availabilityEndTime = self.timelineConverter.calcAvailabilityEndTimeFromPresentationTime(presentationStartTime + period.duration, period.mpd, isDynamic);
            request.quality = representation.index;

            return request;
        },

        getInit = function (representation) {
            var self = this,
                request;

            if (!representation) return null;

            request = generateInitRequest.call(self, representation, type);
            //self.debug.log("Got an initialization.");

            return request;
        },

        isMediaFinished = function (representation) { // TODO
            var sDuration,
                period = representation.adaptation.period,
                isFinished = false,
                seg,
                fTime;

            //this.debug.log("Checking for stream end...");
            if (isDynamic) {
                //this.debug.log("Live never ends! (TODO)");
                // TODO : Check the contents of the last box to signal end.
                isFinished = false;
            } else {
                if (index < 0) {
                    isFinished = false;
                } else if (index < representation.availableSegmentsNumber) {
                    seg = getSegmentByIndex(index, representation);

                    if (seg) {
                        fTime = seg.presentationStartTime - period.start;
                        sDuration = representation.adaptation.period.duration;
                        this.debug.log(representation.segmentInfoType + ": " + fTime + " / " + sDuration);
                        isFinished = (fTime >= sDuration);
                    }
                } else {
                    isFinished = true;
                }
            }

            return isFinished;
        },

        getIndexBasedSegment = function (representation, index) {
            var self = this,
                seg,
                duration,
                presentationStartTime,
                presentationEndTime;

            duration = representation.segmentDuration;
            presentationStartTime = representation.adaptation.period.start + (index * duration);
            presentationEndTime = presentationStartTime + duration;

            seg = new Dash.vo.Segment();

            seg.representation = representation;
            seg.duration = duration;
            seg.presentationStartTime = presentationStartTime;

            seg.mediaStartTime = self.timelineConverter.calcMediaTimeFromPresentationTime(seg.presentationStartTime, representation);

            seg.availabilityStartTime = self.timelineConverter.calcAvailabilityStartTimeFromPresentationTime(seg.presentationStartTime, representation.adaptation.period.mpd, isDynamic);
            seg.availabilityEndTime = self.timelineConverter.calcAvailabilityEndTimeFromPresentationTime(presentationEndTime, representation.adaptation.period.mpd, isDynamic);

            // at this wall clock time, the video element currentTime should be seg.presentationStartTime
            seg.wallStartTime = self.timelineConverter.calcWallTimeForSegment(seg, isDynamic);

            seg.replacementNumber = getNumberForSegment(seg, index);
            seg.availabilityIdx = index;

            return seg;
        },

        getSegmentsFromTimeline = function (representation) {
            var self = this,
                template = representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].
                    AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].SegmentTemplate,
                timeline = template.SegmentTimeline,
                isAvailableSegmentNumberCalculated = representation.availableSegmentsNumber > 0,
                maxSegmentsAhead = 10,
                segments = [],
                fragments,
                frag,
                i,
                len,
                j,
                repeat,
                repeatEndTime,
                nextFrag,
                time = 0,
                scaledTime = 0,
                availabilityIdx = -1,
                calculatedRange,
                hasEnoughSegments,
                requiredMediaTime,
                startIdx,
                endIdx,
                fTimescale,
                createSegment = function(s) {
                    return getTimeBasedSegment.call(
                        self,
                        representation,
                        time,
                        s.d,
                        fTimescale,
                        template.media,
                        s.mediaRange,
                        availabilityIdx);
                };

            fTimescale = representation.timescale;

            fragments = timeline.S_asArray;

            calculatedRange = decideSegmentListRangeForTimeline.call(self, representation);

            // if calculatedRange exists we should generate segments that belong to this range.
            // Otherwise generate maxSegmentsAhead segments ahead of the requested time
            if (calculatedRange) {
                startIdx = calculatedRange.start;
                endIdx = calculatedRange.end;
            } else {
                requiredMediaTime = self.timelineConverter.calcMediaTimeFromPresentationTime(requestedTime || 0, representation);
            }

            for (i = 0, len = fragments.length; i < len; i += 1) {
                frag = fragments[i];
                repeat = 0;
                if (frag.hasOwnProperty("r")) {
                    repeat = frag.r;
                }

                //For a repeated S element, t belongs only to the first segment
                if (frag.hasOwnProperty("t")) {
                    time = frag.t;
                    scaledTime = time / fTimescale;
                }

                //This is a special case: "A negative value of the @r attribute of the S element indicates that the duration indicated in @d attribute repeats until the start of the next S element, the end of the Period or until the 
                // next MPD update."
                if (repeat < 0) {
                    nextFrag = fragments[i+1];

                    if (nextFrag && nextFrag.hasOwnProperty("t")) {
                        repeatEndTime = nextFrag.t / fTimescale;
                    } else {
                        repeatEndTime = self.timelineConverter.calcMediaTimeFromPresentationTime(representation.segmentAvailabilityRange.end, representation);
                        representation.segmentDuration = frag.d / fTimescale;
                    }

                    repeat = Math.ceil((repeatEndTime - scaledTime)/(frag.d/fTimescale)) - 1;
                }

                // if we have enough segments in the list, but we have not calculated the total number of the segments yet we
                // should continue the loop and calc the number. Once it is calculated, we can break the loop.
                if (hasEnoughSegments) {
                    if (isAvailableSegmentNumberCalculated) break;
                    availabilityIdx += repeat + 1;
                    continue;
                }

                for (j = 0; j <= repeat; j += 1) {
                    availabilityIdx += 1;

                    if (calculatedRange) {
                        if (availabilityIdx > endIdx) {
                            hasEnoughSegments = true;
                            if (isAvailableSegmentNumberCalculated) break;
                            continue;
                        }

                        if (availabilityIdx >= startIdx) {
                            segments.push(createSegment.call(self, frag));
                        }
                    } else {
                        if (segments.length > maxSegmentsAhead) {
                            hasEnoughSegments = true;
                            if (isAvailableSegmentNumberCalculated) break;
                            continue;
                        }

                        if (scaledTime >= (requiredMediaTime - (frag.d / fTimescale))) {
                            segments.push(createSegment.call(self, frag));
                        }
                    }

                    time += frag.d;
                    scaledTime = time / fTimescale;
                }
            }

            if (!isAvailableSegmentNumberCalculated) {
                representation.availableSegmentsNumber = availabilityIdx + 1;
            }

            return segments;
        },

        getSegmentsFromTemplate = function (representation) {
            var segments = [],
                self = this,
                template = representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].
                    AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].SegmentTemplate,
                duration = representation.segmentDuration,
                availabilityWindow = representation.segmentAvailabilityRange,
                segmentRange,
                periodSegIdx,
                startIdx,
                endIdx,
                seg = null,
                start,
                url = null;

            start = representation.startNumber;

            segmentRange = decideSegmentListRangeForTemplate.call(self, representation);

            startIdx = segmentRange.start;
            endIdx = segmentRange.end;

            for (periodSegIdx = startIdx;periodSegIdx <= endIdx; periodSegIdx += 1) {

                seg = getIndexBasedSegment.call(
                    self,
                    representation,
                    periodSegIdx);

                seg.replacementTime = (start + periodSegIdx - 1) * representation.segmentDuration;
                url = template.media;
                url = replaceTokenForTemplate(url, "Number", seg.replacementNumber);
                url = replaceTokenForTemplate(url, "Time", seg.replacementTime);
                seg.media = url;

                segments.push(seg);
                seg = null;
            }

            representation.availableSegmentsNumber = Math.ceil((availabilityWindow.end - availabilityWindow.start) / duration);

            return segments;
        },

        decideSegmentListRangeForTemplate = function(representation) {
            var self = this,
                duration = representation.segmentDuration,
                minBufferTime = representation.adaptation.period.mpd.manifest.minBufferTime,
                availabilityWindow = representation.segmentAvailabilityRange,
                periodRelativeRange = {start: self.timelineConverter.calcPeriodRelativeTimeFromMpdRelativeTime(representation, availabilityWindow.start),
                    end: self.timelineConverter.calcPeriodRelativeTimeFromMpdRelativeTime(representation, availabilityWindow.end)},
                originAvailabilityTime = NaN,
                originSegment = null,
                currentSegmentList = representation.segments,
                availabilityLowerLimit = 2 * duration,
                availabilityUpperLimit = Math.max(2 * minBufferTime, 10 * duration),
                start,
                end,
                range;

            if (!periodRelativeRange) {
                periodRelativeRange = self.timelineConverter.calcSegmentAvailabilityRange(representation, isDynamic);
            }
            
            if (isDynamic && !self.timelineConverter.isTimeSyncCompleted()) {
                start = Math.floor(periodRelativeRange.start / duration);
                end = Math.floor(periodRelativeRange.end / duration);
                range = {start: start, end: end};
                return range;
            }

            // if segments exist we should try to find the latest buffered time, which is the presentation time of the
            // segment for the current index
            if (currentSegmentList) {
                originSegment = getSegmentByIndex(index, representation);
                originAvailabilityTime = originSegment ? self.timelineConverter.calcPeriodRelativeTimeFromMpdRelativeTime(representation, originSegment.presentationStartTime) :
                    (index > 0 ? (index * duration) : self.timelineConverter.calcPeriodRelativeTimeFromMpdRelativeTime(representation, requestedTime || currentSegmentList[0].presentationStartTime));
            } else {
                // If no segments exist, but index > 0, it means that we switch to the other representation, so
                // we should proceed from this time.
                // Otherwise we should start from the beginning for static mpds or from the end (live edge) for dynamic mpds
                originAvailabilityTime = (index > 0) ? (index * duration) : (isDynamic ? periodRelativeRange.end : periodRelativeRange.start);
            }

            // segment list should not be out of the availability window range
            start = Math.floor(Math.max(originAvailabilityTime - availabilityLowerLimit, periodRelativeRange.start) / duration);
            end = Math.floor(Math.min(start + availabilityUpperLimit / duration, periodRelativeRange.end / duration));

            range = {start: start, end: end};

            return range;
        },

        decideSegmentListRangeForTimeline = function(/*representation*/) {
            var availabilityLowerLimit = 2,
                availabilityUpperLimit = 10,
                firstIdx = 0,
                lastIdx = Number.POSITIVE_INFINITY,
                start,
                end,
                range;

            if (isDynamic && !this.timelineConverter.isTimeSyncCompleted()) {
                range = {start: firstIdx, end: lastIdx};
                return range;
            }

            if((!isDynamic && requestedTime) || index < 0) return null;

            // segment list should not be out of the availability window range
            start = Math.max(index - availabilityLowerLimit, firstIdx);
            end = Math.min(index + availabilityUpperLimit, lastIdx);

            range = {start: start, end: end};

            return range;
        },

        getTimeBasedSegment = function(representation, time, duration, fTimescale, url, range, index) {
            var self = this,
                scaledTime = time / fTimescale,
                scaledDuration = Math.min(duration / fTimescale, representation.adaptation.period.mpd.maxSegmentDuration),
                presentationStartTime,
                presentationEndTime,
                seg;

            presentationStartTime = self.timelineConverter.calcPresentationTimeFromMediaTime(scaledTime, representation);
            presentationEndTime = presentationStartTime + scaledDuration;

            seg = new Dash.vo.Segment();

            seg.representation = representation;
            seg.duration = scaledDuration;
            seg.mediaStartTime = scaledTime;

            seg.presentationStartTime = presentationStartTime;

            // For SegmentTimeline every segment is available at loadedTime
            seg.availabilityStartTime = representation.adaptation.period.mpd.manifest.loadedTime;
            seg.availabilityEndTime = self.timelineConverter.calcAvailabilityEndTimeFromPresentationTime(presentationEndTime, representation.adaptation.period.mpd, isDynamic);

            // at this wall clock time, the video element currentTime should be seg.presentationStartTime
            seg.wallStartTime = self.timelineConverter.calcWallTimeForSegment(seg, isDynamic);

            seg.replacementTime = time;

            seg.replacementNumber = getNumberForSegment(seg, index);

            url = replaceTokenForTemplate(url, "Number", seg.replacementNumber);
            url = replaceTokenForTemplate(url, "Time", seg.replacementTime);
            seg.media = url;
            seg.mediaRange = range;
            seg.availabilityIdx = index;

            return seg;
        },

        getSegmentsFromList = function (representation) {
            var self = this,
                segments = [],
                list = representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].
                    AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].SegmentList,
                len = list.SegmentURL_asArray.length,
                periodSegIdx,
                seg,
                s,
                range,
                startIdx,
                endIdx,
                start;

            start = representation.startNumber;

            range = decideSegmentListRangeForTemplate.call(self, representation);
            startIdx = Math.max(range.start, 0);
            endIdx = Math.min(range.end, list.SegmentURL_asArray.length - 1);

            for (periodSegIdx = startIdx; periodSegIdx <= endIdx; periodSegIdx += 1) {
                s = list.SegmentURL_asArray[periodSegIdx];

                seg = getIndexBasedSegment.call(
                    self,
                    representation,
                    periodSegIdx);

                seg.replacementTime = (start + periodSegIdx - 1) * representation.segmentDuration;
                seg.media = s.media;
                seg.mediaRange = s.mediaRange;
                seg.index = s.index;
                seg.indexRange = s.indexRange;

                segments.push(seg);
                seg = null;
            }

            representation.availableSegmentsNumber = len;

            return segments;
        },

        getSegments = function (representation) {
            var segments,
                self = this,
                type = representation.segmentInfoType;

                // Already figure out the segments.
            if (type === "SegmentBase" || type === "BaseURL" || !isSegmentListUpdateRequired.call(self, representation)) {
                segments = representation.segments;
            } else {
                if (type === "SegmentTimeline") {
                    segments = getSegmentsFromTimeline.call(self, representation);
                } else if (type === "SegmentTemplate") {
                    segments = getSegmentsFromTemplate.call(self, representation);
                } else if (type === "SegmentList") {
                    segments = getSegmentsFromList.call(self, representation);
                }

                onSegmentListUpdated.call(self, representation, segments);
            }

            return segments;
        },

        onSegmentListUpdated = function(representation, segments) {
            var lastIdx,
                liveEdge,
                metrics,
                lastSegment;

            representation.segments = segments;
            lastIdx = segments.length - 1;
            if (isDynamic && isNaN(this.timelineConverter.getExpectedLiveEdge())) {
                lastSegment = segments[lastIdx];
                liveEdge = lastSegment.presentationStartTime + lastSegment.duration;
                metrics = this.metricsModel.getMetricsFor("stream");
                // the last segment is supposed to be a live edge
                this.timelineConverter.setExpectedLiveEdge(liveEdge);
                this.metricsModel.updateManifestUpdateInfo(this.metricsExt.getCurrentManifestUpdate(metrics), {presentationStartTime: liveEdge});
            }
        },

        updateSegmentList = function(representation) {
            var self = this;

            if (!representation) {
                throw new Error("no representation");
            }

            representation.segments = null;

            getSegments.call(self, representation);

            return representation;
        },

        updateRepresentation = function(representation, keepIdx) {
            var self = this,
                hasInitialization = representation.initialization,
                hasSegments = representation.segmentInfoType !== "BaseURL" && representation.segmentInfoType !== "SegmentBase";

            representation.segmentAvailabilityRange = self.timelineConverter.calcSegmentAvailabilityRange(representation, isDynamic);

            if (!keepIdx) index = -1;

            updateSegmentList.call(self, representation);
            if (!hasInitialization) {
                self.baseURLExt.loadInitialization(representation);
            }

            if (!hasSegments) {
                self.baseURLExt.loadSegments(representation, type, representation.indexRange);
            }

            if (hasInitialization && hasSegments) {
                self.notify(self.eventList.ENAME_REPRESENTATION_UPDATED, representation);
            }
        },

        getIndexForSegments = function (time, representation) {
            var segments = representation.segments,
                ln = segments ? segments.length : null,
                idx = -1,
                frag,
                ft,
                fd,
                i;

            if (segments && ln > 0) {
                for (i = 0; i < ln; i += 1) {
                    frag = segments[i];
                    ft = frag.presentationStartTime;
                    fd = frag.duration;
                    if ((time + fd/2) >= ft &&
                        (time - fd/2) < (ft + fd)) {
                        idx = frag.availabilityIdx;
                        break;
                    }
                }
            }

            // TODO : This is horrible.
            // Temp fix for SegmentTimeline refreshes.
            //if (idx === -1) {
            //    idx = 0;
            //}

            /*
            if (segments && segments.length > 0) {
                idx = 0;
                ft = segments[0].startTime / segments[0].timescale;
                frag = null;

                while (ft <= time && (idx + 1) < segments.length) {
                    frag = segments[idx];
                    ft += frag.duration / frag.timescale;
                    idx += 1;
                }
                idx -= 1;
            }
            */

            return idx;
        },

        getSegmentByIndex = function(index, representation) {
            if (!representation || !representation.segments) return null;

            var ln = representation.segments.length,
                seg,
                i;

            for (i = 0; i < ln; i += 1) {
                seg = representation.segments[i];

                if (seg.availabilityIdx === index) {
                    return seg;
                }
            }

            return null;
        },

        isSegmentListUpdateRequired = function(representation) {
            var updateRequired = false,
                segments = representation.segments,
                upperIdx,
                lowerIdx;

            if (!segments || segments.length === 0) {
                updateRequired = true;
            } else {
                lowerIdx = segments[0].availabilityIdx;
                upperIdx = segments[segments.length -1].availabilityIdx;
                updateRequired = (index < lowerIdx) || (index > upperIdx);
            }

            return updateRequired;
        },

        getRequestForSegment = function (segment) {
            if (segment === null || segment === undefined) {
                return null;
            }

            var request = new MediaPlayer.vo.FragmentRequest(),
                representation = segment.representation,
                bandwidth = representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].
                    AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].bandwidth,
                url;

            url = getRequestUrl(segment.media, representation);
            url = replaceTokenForTemplate(url, "Number", segment.replacementNumber);
            url = replaceTokenForTemplate(url, "Time", segment.replacementTime);
            url = replaceTokenForTemplate(url, "Bandwidth", bandwidth);
            url = replaceIDForTemplate(url, representation.id);
            url = unescapeDollarsInTemplate(url);

            request.mediaType = type;
            request.type = "Media Segment";
            request.url = url;
            request.range = segment.mediaRange;
            request.startTime = segment.presentationStartTime;
            request.duration = segment.duration;
            request.timescale = representation.timescale;
            request.availabilityStartTime = segment.availabilityStartTime;
            request.availabilityEndTime = segment.availabilityEndTime;
            request.wallStartTime = segment.wallStartTime;
            request.quality = representation.index;
            request.index = segment.availabilityIdx;

            return request;
        },

        getForTime = function(representation, time, keepIdx) {
            var request,
                segment,
                finished,
                idx = index,
                self = this;

            if (!representation) {
                return null;
            }

            requestedTime = time;

            self.debug.log("Getting the request for time: " + time);

            index = getIndexForSegments.call(self, time, representation);
            getSegments.call(self, representation);

            if (index < 0) {
                index = getIndexForSegments.call(self, time, representation);
            }

            //self.debug.log("Got segments.");
            //self.debug.log(segments);
            //self.debug.log("Got a list of segments, so dig deeper.");
            self.debug.log("Index for time " + time + " is " + index);

            finished = isMediaFinished.call(self, representation);

            //self.debug.log("Stream finished? " + finished);
            if (finished) {
                request = new MediaPlayer.vo.FragmentRequest();
                request.action = request.ACTION_COMPLETE;
                request.index = index;
                request.mediaType = type;
                self.debug.log("Signal complete.");
                self.debug.log(request);
            } else {
                //self.debug.log("Got a request.");
                //self.debug.log(request);
                segment = getSegmentByIndex(index, representation);
                request = getRequestForSegment.call(self, segment);
            }

            if (keepIdx) {
                index = idx;
            }

            return request;
        },

        generateForTime = function(representation, time) {
            var step = (representation.segmentAvailabilityRange.end - representation.segmentAvailabilityRange.start) / 2;

            representation.segments = null;
            representation.segmentAvailabilityRange = {start: time - step, end: time + step};
            return getForTime.call(this, representation, time, false);
        },

        getNext = function (representation) {
            var request,
                segment,
                finished,
                idx,
                self = this;

            if (!representation) {
                return null;
            }

            //self.debug.log("Getting the next request.");

            if (index === -1) {
                throw "You must call getSegmentRequestForTime first.";
            }

            requestedTime = null;
            index += 1;
            idx = index;

            //self.debug.log("New index: " + index);

            finished = isMediaFinished.call(self, representation);

            //self.debug.log("Stream finished? " + finished);
            if (finished) {
                request = new MediaPlayer.vo.FragmentRequest();
                request.action = request.ACTION_COMPLETE;
                request.index = idx;
                request.mediaType = type;
                self.debug.log("Signal complete.");
                //self.debug.log(request);
            } else {
                getSegments.call(self, representation);
                //self.debug.log("Got segments.");
                //self.debug.log(segments);
                segment = getSegmentByIndex(idx, representation);
                request = getRequestForSegment.call(self, segment);
            }

            return request;
        },

        onInitializationLoaded = function(sender, representation) {
            //self.debug.log("Got an initialization.");
            if (!representation.segments) return;

            this.notify(this.eventList.ENAME_REPRESENTATION_UPDATED, representation);
        },

        onSegmentsLoaded = function(sender, fragments, representation, typeValue, error) {
            if (error || (type !== typeValue)) return;

            var self = this,
                i,
                len,
                s,
                segments = [],
                count = 0,
                seg;

            for (i = 0, len = fragments.length; i < len; i+=1) {
                s = fragments[i];

                seg = getTimeBasedSegment.call(
                    self,
                    representation,
                    s.startTime,
                    s.duration,
                    s.timescale,
                    s.media,
                    s.mediaRange,
                    count);

                segments.push(seg);
                seg = null;
                count += 1;
            }

            representation.segmentAvailabilityRange = {start: segments[0].presentationStartTime, end: segments[len - 1].presentationStartTime};
            representation.availableSegmentsNumber = len;

            onSegmentListUpdated.call(self, representation, segments);

            if (!representation.initialization) return;

            this.notify(this.eventList.ENAME_REPRESENTATION_UPDATED, representation);
        };

    return {
        debug: undefined,
        baseURLExt: undefined,
        timelineConverter: undefined,
        metricsModel: undefined,
        metricsExt: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_REPRESENTATION_UPDATED: "representationUpdated"
        },

        setup: function() {
            this.initializationLoaded = onInitializationLoaded;
            this.segmentsLoaded = onSegmentsLoaded;
        },

        initialize: function(streamProcessor) {
            this.subscribe(this.eventList.ENAME_REPRESENTATION_UPDATED, streamProcessor.trackController);
            type = streamProcessor.getType();
            isDynamic = streamProcessor.isDynamic();
            this.streamProcessor = streamProcessor;
        },

        getType: function () {
            return type;
        },

        setType : function (value) {
            type = value;
        },

        getIsDynamic: function () {
            return isDynamic;
        },
        setIsDynamic: function (value) {
            isDynamic = value;
        },

        setCurrentTime: function(value) {
            currentTime = value;
        },

        getCurrentTime: function() {
            return currentTime;
        },

        reset: function() {
            currentTime = 0;
            requestedTime = undefined;
            index = -1;
            this.unsubscribe(this.eventList.ENAME_REPRESENTATION_UPDATED, this.streamProcessor.trackController);
        },

        getInitRequest: getInit,
        getSegmentRequestForTime: getForTime,
        getNextSegmentRequest: getNext,
        generateSegmentRequestForTime: generateForTime,
        updateRepresentation: updateRepresentation
    };
};

Dash.dependencies.DashHandler.prototype = {
    constructor: Dash.dependencies.DashHandler
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


Dash.dependencies.DashManifestExtensions = function () {
    "use strict";
    this.timelineConverter = undefined;
};

Dash.dependencies.DashManifestExtensions.prototype = {
    constructor: Dash.dependencies.DashManifestExtensions,

    getIsTypeOf: function(adaptation, type) {
        "use strict";
        var i,
            len,
            col = adaptation.ContentComponent_asArray,
            mimeTypeRegEx = (type !== "text") ? new RegExp(type) : new RegExp("(vtt|ttml)"),
            representation,
            result = false,
            found = false;

        if (col) {
            for (i = 0, len = col.length; i < len; i += 1) {
                if (col[i].contentType === type) {
                    result = true;
                    found = true;
                }
            }
        }

        if (adaptation.hasOwnProperty("mimeType")) {
            result = mimeTypeRegEx.test(adaptation.mimeType);
            found = true;
        }

        // couldn't find on adaptationset, so check a representation
        if (!found) {
            i = 0;
            len = adaptation.Representation_asArray.length;
            while (!found && i < len) {
                representation = adaptation.Representation_asArray[i];

                if (representation.hasOwnProperty("mimeType")) {
                    result = mimeTypeRegEx.test(representation.mimeType);
                    found = true;
                }

                i += 1;
            }
        }

        return result;
    },

    getIsAudio: function (adaptation) {
        "use strict";

        return this.getIsTypeOf(adaptation, "audio");
    },

    getIsVideo: function (adaptation) {
        "use strict";

        return this.getIsTypeOf(adaptation, "video");
    },

    getIsText: function (adaptation) {
        "use strict";

        return this.getIsTypeOf(adaptation, "text");
    },

    getIsTextTrack: function(type) {
        return (type === "text/vtt" || type === "application/ttml+xml");
    },

    getLanguageForAdaptation: function(adaptation) {
        var lang = "";

        if (adaptation.hasOwnProperty("lang")) {
            lang = adaptation.lang;
        }

        return lang;
    },

    getIsMain: function (/*adaptation*/) {
        "use strict";
        // TODO : Check "Role" node.
        // TODO : Use this somewhere.
        return false;
    },

    processAdaptation: function (adaptation) {
        "use strict";
        if (adaptation.Representation_asArray !== undefined && adaptation.Representation_asArray !== null) {
            adaptation.Representation_asArray.sort(function(a, b) {
                return a.bandwidth - b.bandwidth;
            });
        }

        return adaptation;
    },

    getAdaptationForId: function (id, manifest, periodIndex) {
        "use strict";
        var adaptations = manifest.Period_asArray[periodIndex].AdaptationSet_asArray,
            i,
            len;

        for (i = 0, len = adaptations.length; i < len; i += 1) {
            if (adaptations[i].hasOwnProperty("id") && adaptations[i].id === id) {
                return adaptations[i];
            }
        }

        return null;
    },

    getAdaptationForIndex: function (index, manifest, periodIndex) {
        "use strict";
        var adaptations = manifest.Period_asArray[periodIndex].AdaptationSet_asArray;

        return adaptations[index];
    },

    getIndexForAdaptation: function (adaptation, manifest, periodIndex) {
        "use strict";

        var adaptations = manifest.Period_asArray[periodIndex].AdaptationSet_asArray,
            i,
            len;

        for (i = 0, len = adaptations.length; i < len; i += 1) {
            if (adaptations[i] === adaptation) {
                return i;
            }
        }

        return -1;
    },

    getAdaptationsForType: function (manifest, periodIndex, type) {
        "use strict";

        var self = this,
            adaptationSet = manifest.Period_asArray[periodIndex].AdaptationSet_asArray,
            i,
            len,
            adaptations = [];

        for (i = 0, len = adaptationSet.length; i < len; i += 1) {
            if (this.getIsTypeOf(adaptationSet[i], type)) {
                adaptations.push(self.processAdaptation(adaptationSet[i]));
            }
        }

        return adaptations;
    },

    getAdaptationForType: function (manifest, periodIndex, type) {
        "use strict";
        var i,
            len,
            adaptations,
            self = this;

        adaptations = this.getAdaptationsForType(manifest, periodIndex, type);

        if (!adaptations || adaptations.length === 0) return null;

        for (i = 0, len = adaptations.length; i < len; i += 1) {
            if (self.getIsMain(adaptations[i])) return adaptations[i];
        }

        return adaptations[0];
    },

    getCodec: function (adaptation) {
        "use strict";
        var representation = adaptation.Representation_asArray[0],
            codec = (representation.mimeType + ';codecs="' + representation.codecs + '"');

        return codec;
    },

    getMimeType: function (adaptation) {
        "use strict";
        return adaptation.Representation_asArray[0].mimeType;
    },

    getKID: function (adaptation) {
        "use strict";

        if (!adaptation || !adaptation.hasOwnProperty("cenc:default_KID")) {
            return null;
        }
        return adaptation["cenc:default_KID"];
    },

    getContentProtectionData: function (adaptation) {
        "use strict";
        var contentProtection = null;

        if (adaptation && adaptation.hasOwnProperty("ContentProtection_asArray") && adaptation.ContentProtection_asArray.length !== 0) {
            contentProtection = adaptation.ContentProtection_asArray;
        }
        for (var i = 0; i < adaptation.Representation_asArray.length; i += 1) {
            if (adaptation.Representation_asArray[i].hasOwnProperty("ContentProtection_asArray") && adaptation.Representation_asArray[i].length !== 0) {
                contentProtection = adaptation.Representation_asArray[i].ContentProtection_asArray;
            }
        }

        return contentProtection;
    },

    getIsDynamic: function (manifest) {
        "use strict";
        var isDynamic = false,
            LIVE_TYPE = "dynamic";

        if (manifest.hasOwnProperty("type")) {
            isDynamic = (manifest.type === LIVE_TYPE);
        }

        return isDynamic;
    },

    getIsDVR: function (manifest) {
        "use strict";
        var isDynamic = this.getIsDynamic(manifest),
            containsDVR,
            isDVR;

        containsDVR = !isNaN(manifest.timeShiftBufferDepth);
        isDVR = (isDynamic && containsDVR);

        return isDVR;
    },

    getIsOnDemand: function (manifest) {
        "use strict";
        var isOnDemand = false;

        if (manifest.profiles && manifest.profiles.length > 0) {
            isOnDemand = (manifest.profiles.indexOf("urn:mpeg:dash:profile:isoff-on-demand:2011") !== -1);
        }

        return isOnDemand;
    },

    getDuration: function (manifest) {
        var mpdDuration;

        //@mediaPresentationDuration specifies the duration of the entire Media Presentation.
        //If the attribute is not present, the duration of the Media Presentation is unknown.
        if (manifest.hasOwnProperty("mediaPresentationDuration")) {
            mpdDuration = manifest.mediaPresentationDuration;
        } else {
            mpdDuration = Number.POSITIVE_INFINITY;
        }

        return mpdDuration;
    },

    getBandwidth: function (representation) {
        "use strict";
        return representation.bandwidth;
    },

    getRefreshDelay: function (manifest) {
        "use strict";
        var delay = NaN,
            minDelay = 2;

        if (manifest.hasOwnProperty("minimumUpdatePeriod")) {
            delay = Math.max(parseFloat(manifest.minimumUpdatePeriod), minDelay);
        }

        return delay;
    },

    getRepresentationCount: function (adaptation) {
        "use strict";
        return adaptation.Representation_asArray.length;
    },

    getRepresentationFor: function (index, adaptation) {
        "use strict";
        return adaptation.Representation_asArray[index];
    },

    getRepresentationsForAdaptation: function(manifest, adaptation) {
        var self = this,
            a = self.processAdaptation(manifest.Period_asArray[adaptation.period.index].AdaptationSet_asArray[adaptation.index]),
            representations = [],
            representation,
            initialization,
            segmentInfo,
            r,
            s;

        for (var i = 0; i < a.Representation_asArray.length; i += 1) {
            r = a.Representation_asArray[i];
            representation = new Dash.vo.Representation();
            representation.index = i;
            representation.adaptation = adaptation;

            if (r.hasOwnProperty("id")) {
                representation.id = r.id;
            }

            if (r.hasOwnProperty("SegmentBase")) {
                segmentInfo = r.SegmentBase;
                representation.segmentInfoType = "SegmentBase";
            }
            else if (r.hasOwnProperty("SegmentList")) {
                segmentInfo = r.SegmentList;
                representation.segmentInfoType = "SegmentList";
                representation.useCalculatedLiveEdgeTime = true;
            }
            else if (r.hasOwnProperty("SegmentTemplate")) {
                segmentInfo = r.SegmentTemplate;

                if (segmentInfo.hasOwnProperty("SegmentTimeline")) {
                    representation.segmentInfoType = "SegmentTimeline";
                    s = segmentInfo.SegmentTimeline.S_asArray[segmentInfo.SegmentTimeline.S_asArray.length -1];
                    if (!s.hasOwnProperty("r") || s.r >= 0) {
                        representation.useCalculatedLiveEdgeTime = true;
                    }
                } else {
                    representation.segmentInfoType = "SegmentTemplate";
                }

                if (segmentInfo.hasOwnProperty("initialization")) {
                    representation.initialization = segmentInfo.initialization.split("$Bandwidth$")
                        .join(r.bandwidth).split("$RepresentationID$").join(r.id);
                }
            } else {
                segmentInfo = r.BaseURL;
                representation.segmentInfoType = "BaseURL";
            }

            if (segmentInfo.hasOwnProperty("Initialization")) {
                initialization = segmentInfo.Initialization;
                if (initialization.hasOwnProperty("sourceURL")) {
                    representation.initialization = initialization.sourceURL;
                } else if (initialization.hasOwnProperty("range")) {
                    representation.initialization = r.BaseURL;
                    representation.range = initialization.range;
                }
            } else if (r.hasOwnProperty("mimeType") && self.getIsTextTrack(r.mimeType)) {
                representation.initialization = r.BaseURL;
                representation.range = 0;
            }

            if (segmentInfo.hasOwnProperty("timescale")) {
                representation.timescale = segmentInfo.timescale;
            }
            if (segmentInfo.hasOwnProperty("duration")) {
                // TODO according to the spec @maxSegmentDuration specifies the maximum duration of any Segment in any Representation in the Media Presentation
                // It is also said that for a SegmentTimeline any @d value shall not exceed the value of MPD@maxSegmentDuration, but nothing is said about
                // SegmentTemplate @duration attribute. We need to find out if @maxSegmentDuration should be used instead of calculated duration if the the duration
                // exceeds @maxSegmentDuration
                //representation.segmentDuration = Math.min(segmentInfo.duration / representation.timescale, adaptation.period.mpd.maxSegmentDuration);
                representation.segmentDuration = segmentInfo.duration / representation.timescale;
            }
            if (segmentInfo.hasOwnProperty("startNumber")) {
                representation.startNumber = segmentInfo.startNumber;
            }
            if (segmentInfo.hasOwnProperty("indexRange")) {
                representation.indexRange = segmentInfo.indexRange;
            }
            if (segmentInfo.hasOwnProperty("presentationTimeOffset")) {
                representation.presentationTimeOffset = segmentInfo.presentationTimeOffset / representation.timescale;
            }

            representation.MSETimeOffset = self.timelineConverter.calcMSETimeOffset(representation);
            representations.push(representation);
        }

        return representations;
    },

    getAdaptationsForPeriod: function(manifest, period) {
        var p = manifest.Period_asArray[period.index],
            adaptations = [],
            adaptationSet,
            a;

        for (var i = 0; i < p.AdaptationSet_asArray.length; i += 1) {
            a = p.AdaptationSet_asArray[i];
            adaptationSet = new Dash.vo.AdaptationSet();

            if (a.hasOwnProperty("id")) {
                adaptationSet.id = a.id;
            }

            adaptationSet.index = i;
            adaptationSet.period = period;
            adaptationSet.type = this.getIsAudio(a) ? "audio" : (this.getIsVideo(a) ? "video" : "text");
            adaptations.push(adaptationSet);
        }

        return adaptations;
    },

    getRegularPeriods: function (manifest, mpd) {
        var self = this,
            periods = [],
            isDynamic = self.getIsDynamic(manifest),
            i,
            len,
            p1 = null,
            p = null,
            vo1 = null,
            vo = null;

        for (i = 0, len = manifest.Period_asArray.length; i < len; i += 1) {
            p = manifest.Period_asArray[i];

            // If the attribute @start is present in the Period, then the
            // Period is a regular Period and the PeriodStart is equal
            // to the value of this attribute.
            if (p.hasOwnProperty("start")){
                vo = new Dash.vo.Period();
                vo.start = p.start;
            }
            // If the @start attribute is absent, but the previous Period
            // element contains a @duration attribute then then this new
            // Period is also a regular Period. The start time of the new
            // Period PeriodStart is the sum of the start time of the previous
            // Period PeriodStart and the value of the attribute @duration
            // of the previous Period.
            else if (p1 !== null && p.hasOwnProperty("duration")){
                vo = new Dash.vo.Period();
                vo.start = vo1.start + vo1.duration;
                vo.duration = p.duration;
            }
            // If (i) @start attribute is absent, and (ii) the Period element
            // is the first in the MPD, and (iii) the MPD@type is 'static',
            // then the PeriodStart time shall be set to zero.
            else if (i === 0 && !isDynamic) {
                vo = new Dash.vo.Period();
                vo.start = 0;
            }

            // The Period extends until the PeriodStart of the next Period.
            // The difference between the PeriodStart time of a Period and
            // the PeriodStart time of the following Period.
            if (vo1 !== null && isNaN(vo1.duration))
            {
                vo1.duration = vo.start - vo1.start;
            }

            if (vo !== null && p.hasOwnProperty("id")){
                vo.id = p.id;
            }

            if (vo !== null && p.hasOwnProperty("duration")){
                vo.duration = p.duration;
            }

            if (vo !== null){
                vo.index = i;
                vo.mpd = mpd;
                periods.push(vo);
            }

            p1 = p;
            p = null;
            vo1 = vo;
            vo = null;
        }

        if (periods.length === 0) {
            return periods;
        }

        mpd.checkTime = self.getCheckTime(manifest, periods[0]);
        // The last Period extends until the end of the Media Presentation.
        // The difference between the PeriodStart time of the last Period
        // and the mpd duration
        if (vo1 !== null && isNaN(vo1.duration)) {
            vo1.duration = self.getEndTimeForLastPeriod(mpd) - vo1.start;
        }

        return periods;
    },

    getMpd: function(manifest) {
        var mpd = new Dash.vo.Mpd();

        mpd.manifest = manifest;

        if (manifest.hasOwnProperty("availabilityStartTime")) {
            mpd.availabilityStartTime = new Date(manifest.availabilityStartTime.getTime());
        } else {
            mpd.availabilityStartTime = new Date(manifest.loadedTime.getTime());
        }

        if (manifest.hasOwnProperty("availabilityEndTime")) {
            mpd.availabilityEndTime = new Date(manifest.availabilityEndTime.getTime());
        }

        if (manifest.hasOwnProperty("suggestedPresentationDelay")) {
            mpd.suggestedPresentationDelay = manifest.suggestedPresentationDelay;
        }

        if (manifest.hasOwnProperty("timeShiftBufferDepth")) {
            mpd.timeShiftBufferDepth = manifest.timeShiftBufferDepth;
        }

        if (manifest.hasOwnProperty("maxSegmentDuration")) {
            mpd.maxSegmentDuration = manifest.maxSegmentDuration;
        }

        return mpd;
    },

    getFetchTime: function(manifest, period) {
        // FetchTime is defined as the time at which the server processes the request for the MPD from the client.
        // TODO The client typically should not use the time at which it actually successfully received the MPD, but should
        // take into account delay due to MPD delivery and processing. The fetch is considered successful fetching
        // either if the client obtains an updated MPD or the client verifies that the MPD has not been updated since the previous fetching.
        var fetchTime = this.timelineConverter.calcPresentationTimeFromWallTime(manifest.loadedTime, period);

        return fetchTime;
    },

    getCheckTime: function(manifest, period) {
        var self = this,
            checkTime = NaN,
            fetchTime;

        // If the MPD@minimumUpdatePeriod attribute in the client is provided, then the check time is defined as the
        // sum of the fetch time of this operating MPD and the value of this attribute,
        // i.e. CheckTime = FetchTime + MPD@minimumUpdatePeriod.
        if (manifest.hasOwnProperty("minimumUpdatePeriod")) {
            fetchTime = self.getFetchTime(manifest, period);
            checkTime = fetchTime + manifest.minimumUpdatePeriod;
        }
        // TODO If the MPD@minimumUpdatePeriod attribute in the client is not provided, external means are used to
        // determine CheckTime, such as a priori knowledge, or HTTP cache headers, etc.

        return checkTime;
    },

    getEndTimeForLastPeriod: function(mpd) {
        var periodEnd;

        // if the MPD@mediaPresentationDuration attribute is present, then PeriodEndTime is defined as the end time of the Media Presentation.
        // if the MPD@mediaPresentationDuration attribute is not present, then PeriodEndTime is defined as FetchTime + MPD@minimumUpdatePeriod

        if (mpd.manifest.mediaPresentationDuration) {
            periodEnd = mpd.manifest.mediaPresentationDuration;
        } else if (!isNaN(mpd.checkTime)) {
            // in this case the Period End Time should match CheckTime
            periodEnd = mpd.checkTime;
        } else {
            throw new Error("Must have @mediaPresentationDuration or @minimumUpdatePeriod on MPD or an explicit @duration on the last period.");
        }

        return periodEnd;
    },

    getEventsForPeriod: function(manifest,period) {

        var periodArray = manifest.Period_asArray,
            eventStreams = periodArray[period.index].EventStream_asArray,
            events = [];

        if(eventStreams) {
            for(var i = 0; i < eventStreams.length; i += 1) {
                var eventStream = new Dash.vo.EventStream();
                eventStream.period = period;
                eventStream.timescale = 1;

                if(eventStreams[i].hasOwnProperty("schemeIdUri")) {
                    eventStream.schemeIdUri = eventStreams[i].schemeIdUri;
                } else {
                    throw "Invalid EventStream. SchemeIdUri has to be set";
                }
                if(eventStreams[i].hasOwnProperty("timescale")) {
                    eventStream.timescale = eventStreams[i].timescale;
                }
                if(eventStreams[i].hasOwnProperty("value")) {
                    eventStream.value = eventStreams[i].value;
                }
                for(var j = 0; j < eventStreams[i].Event_asArray.length; j += 1) {
                    var event = new Dash.vo.Event();
                    event.presentationTime = 0;
                    event.eventStream = eventStream;

                    if(eventStreams[i].Event_asArray[j].hasOwnProperty("presentationTime")) {
                        event.presentationTime = eventStreams[i].Event_asArray[j].presentationTime;
                    }
                    if(eventStreams[i].Event_asArray[j].hasOwnProperty("duration")) {
                        event.duration = eventStreams[i].Event_asArray[j].duration;
                    }
                    if(eventStreams[i].Event_asArray[j].hasOwnProperty("id")) {
                        event.id = eventStreams[i].Event_asArray[j].id;
                    }
                    events.push(event);
                }
            }
        }

        return events;
    },

    getEventStreamForAdaptationSet : function (manifest, adaptation) {

        var eventStreams = [],
            inbandStreams = manifest.Period_asArray[adaptation.period.index].
                AdaptationSet_asArray[adaptation.index].InbandEventStream_asArray;

        if(inbandStreams) {
            for(var i = 0; i < inbandStreams.length ; i += 1 ) {
                var eventStream = new Dash.vo.EventStream();
                eventStream.timescale = 1;

                if(inbandStreams[i].hasOwnProperty("schemeIdUri")) {
                    eventStream.schemeIdUri = inbandStreams[i].schemeIdUri;
                } else {
                    throw "Invalid EventStream. SchemeIdUri has to be set";
                }
                if(inbandStreams[i].hasOwnProperty("timescale")) {
                    eventStream.timescale = inbandStreams[i].timescale;
                }
                if(inbandStreams[i].hasOwnProperty("value")) {
                    eventStream.value = inbandStreams[i].value;
                }
                eventStreams.push(eventStream);
            }
        }
        return eventStreams;
    },

    getEventStreamForRepresentation : function (manifest, representation) {

        var eventStreams = [],
            inbandStreams = manifest.Period_asArray[representation.adaptation.period.index].
                AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].InbandEventStream_asArray;

        if(inbandStreams) {
            for(var i = 0; i < inbandStreams.length ; i++ ) {
                var eventStream = new Dash.vo.EventStream();
                eventStream.timescale = 1;
                eventStream.representation = representation;

                if(inbandStreams[i].hasOwnProperty("schemeIdUri")) {
                    eventStream.schemeIdUri = inbandStreams[i].schemeIdUri;
                } else {
                    throw "Invalid EventStream. SchemeIdUri has to be set";
                }
                if(inbandStreams[i].hasOwnProperty("timescale")) {
                    eventStream.timescale = inbandStreams[i].timescale;
                }
                if(inbandStreams[i].hasOwnProperty("value")) {
                    eventStream.value = inbandStreams[i].value;
                }
                eventStreams.push(eventStream);
            }
        }
        return eventStreams;

    }

};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.dependencies.DashMetricsExtensions = function () {
    "use strict";
    var findRepresentationIndexInPeriodArray = function (periodArray, representationId) {
            var period,
                adaptationSet,
                adaptationSetArray,
                representation,
                representationArray,
                periodArrayIndex,
                adaptationSetArrayIndex,
                representationArrayIndex;

            for (periodArrayIndex = 0; periodArrayIndex < periodArray.length; periodArrayIndex = periodArrayIndex + 1) {
                period = periodArray[periodArrayIndex];
                adaptationSetArray = period.AdaptationSet_asArray;
                for (adaptationSetArrayIndex = 0; adaptationSetArrayIndex < adaptationSetArray.length; adaptationSetArrayIndex = adaptationSetArrayIndex + 1) {
                    adaptationSet = adaptationSetArray[adaptationSetArrayIndex];
                    representationArray = adaptationSet.Representation_asArray;
                    for (representationArrayIndex = 0; representationArrayIndex < representationArray.length; representationArrayIndex = representationArrayIndex + 1) {
                        representation = representationArray[representationArrayIndex];
                        if (representationId === representation.id) {
                            return representationArrayIndex;
                        }
                    }
                }
            }

            return -1;
        },

        findRepresentionInPeriodArray = function (periodArray, representationId) {
            var period,
                adaptationSet,
                adaptationSetArray,
                representation,
                representationArray,
                periodArrayIndex,
                adaptationSetArrayIndex,
                representationArrayIndex;

            for (periodArrayIndex = 0; periodArrayIndex < periodArray.length; periodArrayIndex = periodArrayIndex + 1) {
                period = periodArray[periodArrayIndex];
                adaptationSetArray = period.AdaptationSet_asArray;
                for (adaptationSetArrayIndex = 0; adaptationSetArrayIndex < adaptationSetArray.length; adaptationSetArrayIndex = adaptationSetArrayIndex + 1) {
                    adaptationSet = adaptationSetArray[adaptationSetArrayIndex];
                    representationArray = adaptationSet.Representation_asArray;
                    for (representationArrayIndex = 0; representationArrayIndex < representationArray.length; representationArrayIndex = representationArrayIndex + 1) {
                        representation = representationArray[representationArrayIndex];
                        if (representationId === representation.id) {
                            return representation;
                        }
                    }
                }
            }

            return null;
        },

        adaptationIsType = function (adaptation, bufferType) {
            return this.manifestExt.getIsTypeOf(adaptation, bufferType);
        },

        findMaxBufferIndex = function (periodArray, bufferType) {
            var period,
                adaptationSet,
                adaptationSetArray,
                representationArray,
                periodArrayIndex,
                adaptationSetArrayIndex;

            for (periodArrayIndex = 0; periodArrayIndex < periodArray.length; periodArrayIndex = periodArrayIndex + 1) {
                period = periodArray[periodArrayIndex];
                adaptationSetArray = period.AdaptationSet_asArray;
                for (adaptationSetArrayIndex = 0; adaptationSetArrayIndex < adaptationSetArray.length; adaptationSetArrayIndex = adaptationSetArrayIndex + 1) {
                    adaptationSet = adaptationSetArray[adaptationSetArrayIndex];
                    representationArray = adaptationSet.Representation_asArray;
                    if (adaptationIsType.call(this, adaptationSet, bufferType)) {
                        return representationArray.length;
                    }
                }
            }

            return -1;
        },

        getBandwidthForRepresentation = function (representationId) {
            var self = this,
                manifest = self.manifestModel.getValue(),
                representation,
                periodArray = manifest.Period_asArray;

            representation = findRepresentionInPeriodArray.call(self, periodArray, representationId);

            if (representation === null) {
                return null;
            }

            return representation.bandwidth;
        },

        getIndexForRepresentation = function (representationId) {
            var self = this,
                manifest = self.manifestModel.getValue(),
                representationIndex,
                periodArray = manifest.Period_asArray;

            representationIndex = findRepresentationIndexInPeriodArray.call(self, periodArray, representationId);
            return representationIndex;
        },

        getMaxIndexForBufferType = function (bufferType) {
            var self = this,
                manifest = self.manifestModel.getValue(),
                maxIndex,
                periodArray = manifest.Period_asArray;

            maxIndex = findMaxBufferIndex.call(this, periodArray, bufferType);
            return maxIndex;
        },

        getCurrentRepresentationSwitch = function (metrics) {
            if (metrics === null) {
                return null;
            }

            var repSwitch = metrics.RepSwitchList,
                repSwitchLength,
                repSwitchLastIndex,
                currentRepSwitch;

            if (repSwitch === null || repSwitch.length <= 0) {
                return null;
            }

            repSwitchLength = repSwitch.length;
            repSwitchLastIndex = repSwitchLength - 1;

            currentRepSwitch = repSwitch[repSwitchLastIndex];
            return currentRepSwitch;
        },

        getCurrentBufferLevel = function (metrics) {
            if (metrics === null) {
                return null;
            }

            var bufferLevel = metrics.BufferLevel,
                bufferLevelLength,
                bufferLevelLastIndex,
                currentBufferLevel;

            if (bufferLevel === null || bufferLevel.length <= 0) {
                return null;
            }

            bufferLevelLength = bufferLevel.length;
            bufferLevelLastIndex = bufferLevelLength - 1;

            currentBufferLevel = bufferLevel[bufferLevelLastIndex];
            return currentBufferLevel;
        },

        getCurrentPlaybackRate = function (metrics) {
            if (metrics === null) {
                return null;
            }

            var playList = metrics.PlayList,
                trace,
                currentRate;

            if (playList === null || playList.length <= 0) {
                return null;
            }

            trace = playList[playList.length - 1].trace;

            if (trace === null || trace.length <= 0) {
                return null;
            }

            currentRate = trace[trace.length - 1].playbackspeed;
            return currentRate;
        },

        getCurrentHttpRequest = function (metrics) {
            if (metrics === null) {
                return null;
            }

            var httpList = metrics.HttpList,
                httpListLength,
                httpListLastIndex,
                currentHttpList = null;

            if (httpList === null || httpList.length <= 0) {
                return null;
            }

            httpListLength = httpList.length;
            httpListLastIndex = httpListLength - 1;

            while (httpListLastIndex > 0) {
                if (httpList[httpListLastIndex].responsecode) {
                    currentHttpList = httpList[httpListLastIndex];
                    break;
                }
                httpListLastIndex -= 1;
            }
            return currentHttpList;
        },

        getHttpRequests = function (metrics) {
            if (metrics === null) {
                return [];
            }

            return !!metrics.HttpList ? metrics.HttpList : [];
        },

        getCurrentDroppedFrames = function (metrics) {
            if (metrics === null) { return null; }

            var droppedFrames = metrics.DroppedFrames,
                droppedFramesLength,
                droppedFramesLastIndex,
                currentDroppedFrames;

            if (droppedFrames === null || droppedFrames.length <= 0) {
                return null;
            }

            droppedFramesLength = droppedFrames.length;
            droppedFramesLastIndex = droppedFramesLength - 1;
            currentDroppedFrames = droppedFrames[droppedFramesLastIndex];

            return currentDroppedFrames;
        },

        getCurrentSchedulingInfo = function(metrics) {
            if (metrics === null) return null;

            var schedulingInfo = metrics.SchedulingInfo,
                ln,
                lastIdx,
                currentSchedulingInfo;

            if (schedulingInfo === null || schedulingInfo.length <= 0) {
                return null;
            }

            ln = schedulingInfo.length;
            lastIdx = ln - 1;

            currentSchedulingInfo = schedulingInfo[lastIdx];

            return currentSchedulingInfo;
        },

        getCurrentManifestUpdate = function(metrics) {
            if (metrics === null) return null;

            var manifestUpdate = metrics.ManifestUpdate,
                ln,
                lastIdx,
                currentManifestUpdate;

            if (manifestUpdate === null || manifestUpdate.length <= 0) {
                return null;
            }

            ln = manifestUpdate.length;
            lastIdx = ln - 1;

            currentManifestUpdate = manifestUpdate[lastIdx];

            return currentManifestUpdate;
        },

        getCurrentDVRInfo = function (metrics) {

            if (metrics === null) {
                return null;
            }

            var dvrInfo = metrics.DVRInfo,
                dvrInfoLastIndex,
                curentDVRInfo =  null;

            if (dvrInfo === null || dvrInfo.length <= 0) {
                return null;
            }

            dvrInfoLastIndex = dvrInfo.length - 1;
            curentDVRInfo = dvrInfo[dvrInfoLastIndex];

            return curentDVRInfo;
        };

    return {
        manifestModel: undefined,
        manifestExt: undefined,
        getBandwidthForRepresentation : getBandwidthForRepresentation,
        getIndexForRepresentation : getIndexForRepresentation,
        getMaxIndexForBufferType : getMaxIndexForBufferType,
        getCurrentRepresentationSwitch : getCurrentRepresentationSwitch,
        getCurrentBufferLevel : getCurrentBufferLevel,
        getCurrentPlaybackRate: getCurrentPlaybackRate,
        getCurrentHttpRequest : getCurrentHttpRequest,
        getHttpRequests : getHttpRequests,
        getCurrentDroppedFrames : getCurrentDroppedFrames,
        getCurrentSchedulingInfo: getCurrentSchedulingInfo,
        getCurrentDVRInfo : getCurrentDVRInfo,
        getCurrentManifestUpdate: getCurrentManifestUpdate
    };
};

Dash.dependencies.DashMetricsExtensions.prototype = {
    constructor: Dash.dependencies.DashMetricsExtensions
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.dependencies.DashParser = function () {
    "use strict";

    var SECONDS_IN_YEAR = 365 * 24 * 60 * 60,
        SECONDS_IN_MONTH = 30 * 24 * 60 * 60, // not precise!
        SECONDS_IN_DAY = 24 * 60 * 60,
        SECONDS_IN_HOUR = 60 * 60,
        SECONDS_IN_MIN = 60,
        MINUTES_IN_HOUR = 60,
        MILLISECONDS_IN_SECONDS = 1000,
        durationRegex = /^P(([\d.]*)Y)?(([\d.]*)M)?(([\d.]*)D)?T?(([\d.]*)H)?(([\d.]*)M)?(([\d.]*)S)?/,
        datetimeRegex = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]*)(\.[0-9]*)?)?(?:([+-])([0-9]{2})([0-9]{2}))?/,
        numericRegex = /^[-+]?[0-9]+[.]?[0-9]*([eE][-+]?[0-9]+)?$/,
        matchers = [
            {
                type: "duration",
                test: function (str) {
                    return durationRegex.test(str);
                },
                converter: function (str) {
                    //str = "P10Y10M10DT10H10M10.1S";
                    var match = durationRegex.exec(str);
                    return (parseFloat(match[2] || 0) * SECONDS_IN_YEAR +
                            parseFloat(match[4] || 0) * SECONDS_IN_MONTH +
                            parseFloat(match[6] || 0) * SECONDS_IN_DAY +
                            parseFloat(match[8] || 0) * SECONDS_IN_HOUR +
                            parseFloat(match[10] || 0) * SECONDS_IN_MIN +
                            parseFloat(match[12] || 0));
                }
            },
            {
                type: "datetime",
                test: function (str) {
                    return datetimeRegex.test(str);
                },
                converter: function (str) {
                    var match = datetimeRegex.exec(str),
                        utcDate;
                    // If the string does not contain a timezone offset different browsers can interpret it either
                    // as UTC or as a local time so we have to parse the string manually to normalize the given date value for
                    // all browsers
                    utcDate = Date.UTC(
                        parseInt(match[1], 10),
                        parseInt(match[2], 10)-1, // months start from zero
                        parseInt(match[3], 10),
                        parseInt(match[4], 10),
                        parseInt(match[5], 10),
                        (match[6] && parseInt(match[6], 10) || 0),
                        (match[7] && parseFloat(match[7]) * MILLISECONDS_IN_SECONDS) || 0);
                    // If the date has timezone offset take it into account as well
                    if (match[9] && match[10]) {
                        var timezoneOffset = parseInt(match[9], 10) * MINUTES_IN_HOUR + parseInt(match[10], 10);
                        utcDate += (match[8] === '+' ? -1 : +1) * timezoneOffset * SECONDS_IN_MIN * MILLISECONDS_IN_SECONDS;
                    }

                    return new Date(utcDate);
                }
            },
            {
                type: "numeric",
                test: function (str) {
                    return numericRegex.test(str);
                },
                converter: function (str) {
                    return parseFloat(str);
                }
            }
        ],

        getCommonValuesMap = function () {
            var adaptationSet,
                representation,
                subRepresentation,
                common;

            common = [
                {
                    name: 'profiles',
                    merge: false
                },
                {
                    name: 'width',
                    merge: false
                },
                {
                    name: 'height',
                    merge: false
                },
                {
                    name: 'sar',
                    merge: false
                },
                {
                    name: 'frameRate',
                    merge: false
                },
                {
                    name: 'audioSamplingRate',
                    merge: false
                },
                {
                    name: 'mimeType',
                    merge: false
                },
                {
                    name: 'segmentProfiles',
                    merge: false
                },
                {
                    name: 'codecs',
                    merge: false
                },
                {
                    name: 'maximumSAPPeriod',
                    merge: false
                },
                {
                    name: 'startsWithSap',
                    merge: false
                },
                {
                    name: 'maxPlayoutRate',
                    merge: false
                },
                {
                    name: 'codingDependency',
                    merge: false
                },
                {
                    name: 'scanType',
                    merge: false
                },
                {
                    name: 'FramePacking',
                    merge: true
                },
                {
                    name: 'AudioChannelConfiguration',
                    merge: true
                },
                {
                    name: 'ContentProtection',
                    merge: true
                }
            ];

            adaptationSet = {};
            adaptationSet.name = "AdaptationSet";
            adaptationSet.isRoot = false;
            adaptationSet.isArray = true;
            adaptationSet.parent = null;
            adaptationSet.children = [];
            adaptationSet.properties = common;

            representation = {};
            representation.name = "Representation";
            representation.isRoot = false;
            representation.isArray = true;
            representation.parent = adaptationSet;
            representation.children = [];
            representation.properties = common;
            adaptationSet.children.push(representation);

            subRepresentation = {};
            subRepresentation.name = "SubRepresentation";
            subRepresentation.isRoot = false;
            subRepresentation.isArray = true;
            subRepresentation.parent = representation;
            subRepresentation.children = [];
            subRepresentation.properties = common;
            representation.children.push(subRepresentation);

            return adaptationSet;
        },

        getSegmentValuesMap = function () {
            var period,
                adaptationSet,
                representation,
                common;

            common = [
                {
                    name: 'SegmentBase',
                    merge: true
                },
                {
                    name: 'SegmentTemplate',
                    merge: true
                },
                {
                    name: 'SegmentList',
                    merge: true
                }
            ];

            period = {};
            period.name = "Period";
            period.isRoot = false;
            period.isArray = true;
            period.parent = null;
            period.children = [];
            period.properties = common;

            adaptationSet = {};
            adaptationSet.name = "AdaptationSet";
            adaptationSet.isRoot = false;
            adaptationSet.isArray = true;
            adaptationSet.parent = period;
            adaptationSet.children = [];
            adaptationSet.properties = common;
            period.children.push(adaptationSet);

            representation = {};
            representation.name = "Representation";
            representation.isRoot = false;
            representation.isArray = true;
            representation.parent = adaptationSet;
            representation.children = [];
            representation.properties = common;
            adaptationSet.children.push(representation);

            return period;
        },

        getBaseUrlValuesMap = function () {
            var mpd,
                period,
                adaptationSet,
                representation,
                common;

            common = [
                {
                    name: 'BaseURL',
                    merge: true,
                    mergeFunction: function (parentValue, childValue) {
                        var mergedValue;

                        // child is absolute, don't merge
                        if (childValue.indexOf("http://") === 0) {
                            mergedValue = childValue;
                        } else {
                            mergedValue = parentValue + childValue;
                        }

                        return mergedValue;
                    }
                }
            ];

            mpd = {};
            mpd.name = "mpd";
            mpd.isRoot = true;
            mpd.isArray = true;
            mpd.parent = null;
            mpd.children = [];
            mpd.properties = common;

            period = {};
            period.name = "Period";
            period.isRoot = false;
            period.isArray = true;
            period.parent = null;
            period.children = [];
            period.properties = common;
            mpd.children.push(period);

            adaptationSet = {};
            adaptationSet.name = "AdaptationSet";
            adaptationSet.isRoot = false;
            adaptationSet.isArray = true;
            adaptationSet.parent = period;
            adaptationSet.children = [];
            adaptationSet.properties = common;
            period.children.push(adaptationSet);

            representation = {};
            representation.name = "Representation";
            representation.isRoot = false;
            representation.isArray = true;
            representation.parent = adaptationSet;
            representation.children = [];
            representation.properties = common;
            adaptationSet.children.push(representation);

            return mpd;
        },

        getDashMap = function () {
            var result = [];

            result.push(getCommonValuesMap());
            result.push(getSegmentValuesMap());
            result.push(getBaseUrlValuesMap());

            return result;
        },

        internalParse = function (data, baseUrl) {
            //this.debug.log("Doing parse.");

            var manifest,
                converter = new X2JS(matchers, '', true),
                iron = new ObjectIron(getDashMap()),
                start = new Date(),
                json = null,
                ironed = null;

            try {
                //this.debug.log("Converting from XML.");
                manifest = converter.xml_str2json(data);
                json = new Date();

                if (!manifest.hasOwnProperty("BaseURL")) {
                    //this.debug.log("Setting baseURL: " + baseUrl);
                    manifest.BaseURL = baseUrl;
                } else {
                    // Setting manifest's BaseURL to the first BaseURL
                    manifest.BaseURL = manifest.BaseURL_asArray[0];

                    if (manifest.BaseURL.toString().indexOf("http") !== 0) {
                        manifest.BaseURL = baseUrl + manifest.BaseURL;
                    }
                }

                //this.debug.log("Flatten manifest properties.");
                iron.run(manifest);
                ironed = new Date();

                this.debug.log("Parsing complete: ( xml2json: " + (json.getTime() - start.getTime()) + "ms, objectiron: " + (ironed.getTime() - json.getTime()) + "ms, total: " + ((ironed.getTime() - start.getTime()) / 1000) + "s)");
            } catch (err) {
                this.errHandler.manifestError("parsing the manifest failed", "parse", data);
                return null;
            }
            return manifest;
        };

    return {
        debug: undefined,
        errHandler: undefined,
        parse: internalParse
    };
};

Dash.dependencies.DashParser.prototype = {
    constructor: Dash.dependencies.DashParser
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.dependencies.FragmentExtensions = function () {
    "use strict";

    var parseTFDT = function (ab) {
            var d = new DataView(ab),
                pos = 0,
                base_media_decode_time,
                version,
                size,
                type,
                i,
                c;

            while (type !== "tfdt" && pos < d.byteLength) {
                size = d.getUint32(pos); // subtract 8 for including the size and type
                pos += 4;

                type = "";
                for (i = 0; i < 4; i += 1) {
                    c = d.getInt8(pos);
                    type += String.fromCharCode(c);
                    pos += 1;
                }

                if (type !== "moof" && type !== "traf" && type !== "tfdt") {
                    pos += size - 8;
                }
            }

            if (pos === d.byteLength) {
                throw "Error finding live offset.";
            }

            version = d.getUint8(pos);

            this.debug.log("position: " + pos);

            if (version === 0) {
                pos += 4;
                base_media_decode_time = d.getUint32(pos, false);
            } else {
                pos += size - 16;
                base_media_decode_time = utils.Math.to64BitNumber(d.getUint32(pos + 4, false), d.getUint32(pos, false));
            }

            return {
                'version' : version,
                'base_media_decode_time' : base_media_decode_time
            };
        },

        parseSIDX = function (ab) {
            var d = new DataView(ab),
                pos = 0,
                version,
                timescale,
                earliest_presentation_time,
                i,
                type,
                size,
                charCode;

            while (type !== "sidx" && pos < d.byteLength) {
                size = d.getUint32(pos); // subtract 8 for including the size and type
                pos += 4;

                type = "";
                for (i = 0; i < 4; i += 1) {
                    charCode = d.getInt8(pos);
                    type += String.fromCharCode(charCode);
                    pos += 1;
                }

                if (type !== "moof" && type !== "traf" && type !== "sidx") {
                    pos += size - 8;
                } else if (type === "sidx") {
                    // reset the position to the beginning of the box...
                    // if we do not reset the position, the evaluation
                    // of sidxEnd to ab.byteLength will fail.
                    pos -= 8;
                }
            }

            version = d.getUint8(pos + 8);
            pos += 12;

            // skipped reference_ID(32)
            timescale = d.getUint32(pos + 4, false);
            pos += 8;

            if (version === 0) {
                earliest_presentation_time = d.getUint32(pos, false);
            } else {
                earliest_presentation_time = utils.Math.to64BitNumber(d.getUint32(pos + 4, false), d.getUint32(pos, false));
            }

            return {
                'earliestPresentationTime' : earliest_presentation_time,
                'timescale' : timescale
            };
        },

        loadFragment = function (media) {
            var self = this,
                request = new XMLHttpRequest(),
                url,
                loaded = false,
                errorStr,
                parsed;

            url = media;

            request.onloadend = function () {
                if (!loaded) {
                    errorStr = "Error loading fragment: " + url;
                    self.notify(self.eventList.ENAME_FRAGMENT_LOADING_COMPLETED, null, new Error(errorStr));
                }
            };

            request.onload = function () {
                loaded = true;
                parsed = parseTFDT(request.response);
                self.notify(self.eventList.ENAME_FRAGMENT_LOADING_COMPLETED, parsed);
            };

            request.onerror = function () {
                errorStr = "Error loading fragment: " + url;
                self.notify(self.eventList.ENAME_FRAGMENT_LOADING_COMPLETED, null, new Error(errorStr));
            };

            request.responseType = "arraybuffer";
            request.open("GET", url);
            request.send(null);
        };

    return {
        debug : undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_FRAGMENT_LOADING_COMPLETED: "fragmentLoadingCompleted"
        },

        loadFragment : loadFragment,
        parseTFDT : parseTFDT,
        parseSIDX : parseSIDX
    };
};

Dash.dependencies.FragmentExtensions.prototype = {
    constructor: Dash.dependencies.FragmentExtensions
};;Dash.dependencies.RepresentationController = function () {
    "use strict";

    var data = null,
        dataIndex = -1,
        updating = true,
        availableRepresentations = [],
        currentRepresentation,

        updateData = function(dataValue, adaptation, type) {
            var self = this;

            updating = true;
            self.notify(self.eventList.ENAME_DATA_UPDATE_STARTED);

            availableRepresentations = updateRepresentations.call(self, adaptation);
            currentRepresentation = getRepresentationForQuality.call(self, self.abrController.getQualityFor(type, self.streamProcessor.getStreamInfo()));
            data = dataValue;

            if (type !== "video" && type !== "audio") {
                self.notify(self.eventList.ENAME_DATA_UPDATE_COMPLETED, data, currentRepresentation);
                addRepresentationSwitch.call(self);
                return;
            }

            for (var i = 0; i < availableRepresentations.length; i += 1) {
                self.indexHandler.updateRepresentation(availableRepresentations[i], true);
            }
        },

        addRepresentationSwitch = function() {
            var now = new Date(),
                currentRepresentation = this.getCurrentRepresentation(),
                currentVideoTime = this.streamProcessor.playbackController.getTime();

            this.metricsModel.addTrackSwitch(currentRepresentation.adaptation.type, now, currentVideoTime, currentRepresentation.id);
        },

        getRepresentationForQuality = function(quality) {
            return availableRepresentations[quality];
        },

        isAllRepresentationsUpdated = function() {
            for (var i = 0, ln = availableRepresentations.length; i < ln; i += 1) {
                if (availableRepresentations[i].segmentAvailabilityRange === null || availableRepresentations[i].initialization === null) return false;
            }

            return true;
        },

        updateRepresentations = function(adaptation) {
            var self = this,
                reps,
                manifest = self.manifestModel.getValue();

            dataIndex = self.manifestExt.getIndexForAdaptation(data, manifest, adaptation.period.index);
            reps = self.manifestExt.getRepresentationsForAdaptation(manifest, adaptation);

            return reps;
        },

        updateAvailabilityWindow = function(isDynamic) {
            var self = this,
                rep;

            for (var i = 0, ln = availableRepresentations.length; i < ln; i +=1) {
                rep = availableRepresentations[i];
                rep.segmentAvailabilityRange = self.timelineConverter.calcSegmentAvailabilityRange(rep, isDynamic);
            }
        },

        onRepresentationUpdated = function(sender, representation) {
            var self = this,
                r = representation,
                metrics = self.metricsModel.getMetricsFor("stream"),
                manifestUpdateInfo = self.metricsExt.getCurrentManifestUpdate(metrics),
                repInfo,
                alreadyAdded = false;

            for (var i = 0; i < manifestUpdateInfo.trackInfo.length; i += 1) {
                repInfo = manifestUpdateInfo.trackInfo[i];
                if (repInfo.index === r.index && repInfo.mediaType === self.streamProcessor.getType()) {
                    alreadyAdded = true;
                    break;
                }
            }

            if (!alreadyAdded) {
                self.metricsModel.addManifestUpdateTrackInfo(manifestUpdateInfo, r.id, r.index, r.adaptation.period.index,
                    self.streamProcessor.getType(),r.presentationTimeOffset, r.startNumber, r.segmentInfoType);
            }

            if (isAllRepresentationsUpdated()) {
                updating = false;
                self.metricsModel.updateManifestUpdateInfo(manifestUpdateInfo, {latency: currentRepresentation.segmentAvailabilityRange.end - self.streamProcessor.playbackController.getTime()});
                this.notify(this.eventList.ENAME_DATA_UPDATE_COMPLETED, data, currentRepresentation);
                addRepresentationSwitch.call(self);
            }
        },

        onWallclockTimeUpdated = function(sender, isDynamic/*, wallclockTime*/) {
            updateAvailabilityWindow.call(this, isDynamic);
        },

        onLiveEdgeFound = function(/*sender, liveEdgeTime, searchTime*/) {
            updateAvailabilityWindow.call(this, true);
            this.indexHandler.updateRepresentation(currentRepresentation, false);

            // we need to update checkTime after we have found the live edge because its initial value
            // does not take into account clientServerTimeShift
            var manifest = this.manifestModel.getValue();
            currentRepresentation.adaptation.period.mpd.checkTime = this.manifestExt.getCheckTime(manifest, currentRepresentation.adaptation.period);
        },

        onBufferLevelUpdated = function(sender/*, bufferLevel*/) {
            var streamProcessor = sender.streamProcessor,
                self = this,
                range = self.timelineConverter.calcSegmentAvailabilityRange(currentRepresentation, streamProcessor.isDynamic());

            self.metricsModel.addDVRInfo(streamProcessor.getType(), streamProcessor.playbackController.getTime(), streamProcessor.getStreamInfo().manifestInfo, range);
        },

        onQualityChanged = function(sender, type, streamInfo, oldQuality, newQuality) {
            var self = this;

            if (type !== self.streamProcessor.getType() || self.streamProcessor.getStreamInfo().id !== streamInfo.id) return;

            currentRepresentation = self.getRepresentationForQuality(newQuality);
            addRepresentationSwitch.call(self);
        };

    return {
        system: undefined,
        debug: undefined,
        manifestExt: undefined,
        manifestModel: undefined,
        metricsModel: undefined,
        metricsExt: undefined,
        abrController: undefined,
        timelineConverter: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_DATA_UPDATE_COMPLETED: "dataUpdateCompleted",
            ENAME_DATA_UPDATE_STARTED: "dataUpdateStarted"
        },

        setup: function() {
            this.qualityChanged = onQualityChanged;
            this.representationUpdated = onRepresentationUpdated;
            this.wallclockTimeUpdated = onWallclockTimeUpdated;
            this.liveEdgeFound = onLiveEdgeFound;
            this.bufferLevelUpdated = onBufferLevelUpdated;
        },

        initialize: function(streamProcessor) {
            this.streamProcessor = streamProcessor;
            this.indexHandler = streamProcessor.indexHandler;
        },

        getData: function() {
            return data;
        },

        getDataIndex: function() {
            return dataIndex;
        },

        isUpdating: function() {
            return updating;
        },

        updateData: updateData,
        getRepresentationForQuality: getRepresentationForQuality,

        getCurrentRepresentation: function() {
            return currentRepresentation;
        }
    };
};

Dash.dependencies.RepresentationController.prototype = {
    constructor: Dash.dependencies.RepresentationController
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.dependencies.TimelineConverter = function () {
    "use strict";

    var clientServerTimeShift = 0,
        isClientServerTimeSyncCompleted = false,
        expectedLiveEdge = NaN,

        calcAvailabilityTimeFromPresentationTime = function (presentationTime, mpd, isDynamic, calculateEnd) {
            var availabilityTime = NaN;

            if (calculateEnd) {
                //@timeShiftBufferDepth specifies the duration of the time shifting buffer that is guaranteed
                // to be available for a Media Presentation with type 'dynamic'.
                // When not present, the value is infinite.
                if (isDynamic && (mpd.timeShiftBufferDepth != Number.POSITIVE_INFINITY)) {
                    availabilityTime = new Date(mpd.availabilityStartTime.getTime() + ((presentationTime + mpd.timeShiftBufferDepth) * 1000));
                } else {
                    availabilityTime = mpd.availabilityEndTime;
                }
            } else {
                if (isDynamic) {
                    availabilityTime = new Date(mpd.availabilityStartTime.getTime() + (presentationTime - clientServerTimeShift) * 1000);
                } else {
                    // in static mpd, all segments are available at the same time
                    availabilityTime = mpd.availabilityStartTime;
                }
            }

            return availabilityTime;
        },

        calcAvailabilityStartTimeFromPresentationTime = function(presentationTime, mpd, isDynamic) {
            return calcAvailabilityTimeFromPresentationTime.call(this, presentationTime, mpd, isDynamic);
        },

        calcAvailabilityEndTimeFromPresentationTime = function (presentationTime, mpd, isDynamic) {
            return calcAvailabilityTimeFromPresentationTime.call(this, presentationTime, mpd, isDynamic, true);
        },

        calcPresentationTimeFromWallTime = function (wallTime, period) {
            return ((wallTime.getTime() - period.mpd.availabilityStartTime.getTime() + clientServerTimeShift * 1000) / 1000);
        },

        calcPresentationTimeFromMediaTime = function (mediaTime, representation) {
            var periodStart = representation.adaptation.period.start,
                presentationOffset = representation.presentationTimeOffset;

            return mediaTime + (periodStart - presentationOffset);
        },

        calcMediaTimeFromPresentationTime = function (presentationTime, representation) {
            var periodStart = representation.adaptation.period.start,
                presentationOffset = representation.presentationTimeOffset;

            return presentationTime - periodStart + presentationOffset;
        },

        calcWallTimeForSegment = function (segment, isDynamic) {
            var suggestedPresentationDelay,
                displayStartTime,
                wallTime;

            if (isDynamic) {
                suggestedPresentationDelay = segment.representation.adaptation.period.mpd.suggestedPresentationDelay;
                displayStartTime = segment.presentationStartTime + suggestedPresentationDelay;
                wallTime = new Date(segment.availabilityStartTime.getTime() + (displayStartTime * 1000));
            }

            return wallTime;
        },

        calcSegmentAvailabilityRange = function(representation, isDynamic) {
            var start = representation.adaptation.period.start,
                end = start + representation.adaptation.period.duration,
                range = {start: start, end: end},
                checkTime,
                now;

            if (!isDynamic) return range;

            if (!isClientServerTimeSyncCompleted && representation.segmentAvailabilityRange) {
                return representation.segmentAvailabilityRange;
            }

            checkTime = representation.adaptation.period.mpd.checkTime;
            now = calcPresentationTimeFromWallTime(new Date((new Date().getTime())), representation.adaptation.period);
            //the Media Segment list is further restricted by the CheckTime together with the MPD attribute
            // MPD@timeShiftBufferDepth such that only Media Segments for which the sum of the start time of the
            // Media Segment and the Period start time falls in the interval [NOW- MPD@timeShiftBufferDepth - @duration, min(CheckTime, NOW)] are included.
            start = Math.max((now - representation.adaptation.period.mpd.timeShiftBufferDepth), 0);
            end = isNaN(checkTime) ? now : Math.min(checkTime, now);
            range = {start: start, end: end};

            return range;
        },

        calcPeriodRelativeTimeFromMpdRelativeTime = function(representation, mpdRelativeTime) {
            var periodStartTime = representation.adaptation.period.start;

            return mpdRelativeTime - periodStartTime;
        },

        calcMpdRelativeTimeFromPeriodRelativeTime = function(representation, periodRelativeTime) {
            var periodStartTime = representation.adaptation.period.start;

            return periodRelativeTime + periodStartTime;
        },

        onLiveEdgeFound = function(sender, actualLiveEdge, searchTime) {
            if (isClientServerTimeSyncCompleted) return;

            // the difference between expected and actual live edge time is supposed to be a difference between client
            // and server time as well
            clientServerTimeShift = actualLiveEdge - (expectedLiveEdge + searchTime);
            isClientServerTimeSyncCompleted = true;
        },

        calcMSETimeOffset = function (representation) {
            // The MSEOffset is offset from AST for media. It is Period@start - presentationTimeOffset
            var presentationOffset = representation.presentationTimeOffset;
            var periodStart = representation.adaptation.period.start;
            return (periodStart - presentationOffset);
        },

        reset = function() {
            clientServerTimeShift = 0;
            isClientServerTimeSyncCompleted = false;
            expectedLiveEdge = NaN;
        };

    return {
        notifier: undefined,
        uriQueryFragModel:undefined,

        setup: function() {
            this.liveEdgeFound = onLiveEdgeFound;
        },

        calcAvailabilityStartTimeFromPresentationTime: calcAvailabilityStartTimeFromPresentationTime,
        calcAvailabilityEndTimeFromPresentationTime: calcAvailabilityEndTimeFromPresentationTime,
        calcPresentationTimeFromWallTime: calcPresentationTimeFromWallTime,
        calcPresentationTimeFromMediaTime: calcPresentationTimeFromMediaTime,
        calcPeriodRelativeTimeFromMpdRelativeTime: calcPeriodRelativeTimeFromMpdRelativeTime,
        calcMpdRelativeTimeFromPeriodRelativeTime: calcMpdRelativeTimeFromPeriodRelativeTime,
        calcMediaTimeFromPresentationTime: calcMediaTimeFromPresentationTime,
        calcSegmentAvailabilityRange: calcSegmentAvailabilityRange,
        calcWallTimeForSegment: calcWallTimeForSegment,
        calcMSETimeOffset: calcMSETimeOffset,
        reset: reset,

        isTimeSyncCompleted: function() {
            return isClientServerTimeSyncCompleted;
        },

        getClientTimeOffset: function() {
            return clientServerTimeShift;
        },

        getExpectedLiveEdge: function() {
            return expectedLiveEdge;
        },

        setExpectedLiveEdge: function(value) {
            expectedLiveEdge = value;
        }
    };
};

Dash.dependencies.TimelineConverter.prototype = {
    constructor: Dash.dependencies.TimelineConverter
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.vo.AdaptationSet = function () {
    "use strict";
    this.period = null;
    this.index = -1;
    this.type = null;
};

Dash.vo.AdaptationSet.prototype = {
    constructor: Dash.vo.AdaptationSet
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Fraunhofer Fokus
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.vo.Event = function () {
    "use strict";
    this.duration = NaN;
    this.presentationTime = NaN;
    this.id = NaN;
    this.messageData = "";
    this.eventStream = null;
    this.presentationTimeDelta = NaN; // Specific EMSG Box paramater

};

Dash.vo.Event.prototype = {
    constructor: Dash.vo.Event
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Fraunhofer Fokus
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.vo.EventStream = function () {
    "use strict";
    this.adaptionSet = null;
    this.representation = null;
    this.period = null;
    this.timescale = 1;
    this.value = "";
    this.schemeIdUri = "";
};

Dash.vo.EventStream.prototype = {
    constructor: Dash.vo.EventStream
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.vo.Mpd = function () {
    "use strict";
    this.manifest = null;
    this.suggestedPresentationDelay = 0;
    this.availabilityStartTime = null;
    this.availabilityEndTime = Number.POSITIVE_INFINITY;
    this.timeShiftBufferDepth = Number.POSITIVE_INFINITY;
    this.maxSegmentDuration = Number.POSITIVE_INFINITY;
    this.checkTime = NaN;
    this.clientServerTimeShift = 0;
    this.isClientServerTimeSyncCompleted = false;
};

Dash.vo.Mpd.prototype = {
    constructor: Dash.vo.Mpd
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.vo.Period = function () {
    "use strict";
    this.id = null;
    this.index = -1;
    this.duration = NaN;
    this.start = NaN;
    this.mpd = null;
};

Dash.vo.Period.prototype = {
    constructor: Dash.vo.Period
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.vo.Representation = function () {
    "use strict";
    this.id = null;
    this.index = -1;
    this.adaptation = null;
    this.segmentInfoType = null;
    this.initialization = null;
    this.segmentDuration = NaN;
    this.timescale = 1;
    this.startNumber = 1;
    this.indexRange = null;
    this.range = null;
    this.presentationTimeOffset = 0;
    // Set the source buffer timeOffset to this
    this.MSETimeOffset = NaN;
    this.segmentAvailabilityRange = null;
    this.availableSegmentsNumber = 0;
};

Dash.vo.Representation.prototype = {
    constructor: Dash.vo.Representation
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Dash.vo.Segment = function () {
    "use strict";
    this.indexRange = null;
    this.index = null;
    this.mediaRange = null;
    this.media = null;
    this.duration = NaN;
    // this is the time that should be inserted into the media url
    this.replacementTime = null;
    // this is the number that should be inserted into the media url
    this.replacementNumber = NaN;
    // This is supposed to match the time encoded in the media Segment
    this.mediaStartTime = NaN;
    // When the source buffer timeOffset is set to MSETimeOffset this is the 
    // time that will match the seekTarget and video.currentTime
    this.presentationStartTime = NaN;
    // Do not schedule this segment until 
    this.availabilityStartTime = NaN;
    // Ignore and  discard this segment after
    this.availabilityEndTime = NaN;
    // The index of the segment inside the availability window
    this.availabilityIdx = NaN;
    // For dynamic mpd's, this is the wall clock time that the video   
    // element currentTime should be presentationStartTime
    this.wallStartTime = NaN;
    this.representation = null;
};

Dash.vo.Segment.prototype = {
    constructor: Dash.vo.Segment
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.AbrController = function () {
    "use strict";

    var autoSwitchBitrate = true,
        topQualities = {},
        qualityDict = {},
        confidenceDict = {},

        getInternalQuality = function (type, id) {
            var quality;

            qualityDict[id] = qualityDict[id] || {};

            if (!qualityDict[id].hasOwnProperty(type)) {
                qualityDict[id][type] = 0;
            }

            quality = qualityDict[id][type];

            return quality;
        },

        setInternalQuality = function (type, id, value) {
            qualityDict[id] = qualityDict[id] || {};
            qualityDict[id][type] = value;
        },

        getInternalConfidence = function (type, id) {
            var confidence;

            confidenceDict[id] = confidenceDict[id] || {};

            if (!confidenceDict[id].hasOwnProperty(type)) {
                confidenceDict[id][type] = 0;
            }

            confidence = confidenceDict[id][type];

            return confidence;
        },

        setInternalConfidence = function (type, id, value) {
            confidenceDict[id] = confidenceDict[id] || {};
            confidenceDict[id][type] = value;
        },

        setTopQualityIndex = function (type, id, value) {
            topQualities[id] = topQualities[id] || {};
            topQualities[id][type] = value;
        },

        getTopQualityIndex = function(type, id) {
            var idx;

            topQualities[id] = topQualities[id] || {};

            if (!topQualities[id].hasOwnProperty(type)) {
                topQualities[id][type] = 0;
            }

            idx = topQualities[id][type];

            return idx;
        },

        onDataUpdateCompleted = function(sender, data, trackData) {
            var self = this,
                mediaInfo = this.adapter.convertDataToTrack(trackData).mediaInfo,
                type = mediaInfo.type,
                streamId = mediaInfo.streamInfo.id,
                max;

            max = mediaInfo.trackCount - 1;

            if (getTopQualityIndex(type, streamId) === max) return;

            setTopQualityIndex(type, streamId, max);
            self.notify(self.eventList.ENAME_TOP_QUALITY_INDEX_CHANGED, type, mediaInfo.streamInfo, max);
        };

    return {
        debug: undefined,
        adapter: undefined,
        abrRulesCollection: undefined,
        rulesController: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_QUALITY_CHANGED: "qualityChanged",
            ENAME_TOP_QUALITY_INDEX_CHANGED: "topQualityIndexChanged"
        },

        setup: function() {
            this.dataUpdateCompleted = onDataUpdateCompleted;
        },

        getAutoSwitchBitrate: function () {
            return autoSwitchBitrate;
        },

        setAutoSwitchBitrate: function (value) {
            autoSwitchBitrate = value;
        },

        getPlaybackQuality: function (streamProcessor) {
            var self = this,
                type = streamProcessor.getType(),
                streamId = streamProcessor.getStreamInfo().id,
                quality,
                oldQuality,
                rules,
                confidence,

                callback = function(res) {
                    var topQualityIdx = getTopQualityIndex(type, streamId);

                    quality = res.value;
                    confidence = res.confidence;

                    // be sure the quality valid!
                    if (quality < 0) {
                        quality = 0;
                    }
                    // zero based
                    if (quality > topQualityIdx) {
                        quality = topQualityIdx;
                    }

                    oldQuality = getInternalQuality(type, streamId);

                    if (quality === oldQuality) return;

                    setInternalQuality(type, streamId, quality);
                    //self.debug.log("New quality of " + quality);
                    setInternalConfidence(type, streamId, confidence);
                    //self.debug.log("New confidence of " + confidence);

                    self.notify(self.eventList.ENAME_QUALITY_CHANGED, type, streamProcessor.getStreamInfo(), oldQuality, quality);
                };

            quality = getInternalQuality(type, streamId);

            confidence = getInternalConfidence(type, streamId);

            //self.debug.log("ABR enabled? (" + autoSwitchBitrate + ")");

            if (!autoSwitchBitrate) return;

            //self.debug.log("Check ABR rules.");

            if (self.abrRulesCollection.downloadRatioRule) {
                self.abrRulesCollection.downloadRatioRule.setStreamProcessor(streamProcessor);
            }

            rules = self.abrRulesCollection.getRules(MediaPlayer.rules.ABRRulesCollection.prototype.QUALITY_SWITCH_RULES);

            self.rulesController.applyRules(rules, streamProcessor, callback.bind(self), quality, function(currentValue, newValue) {
                return Math.min(currentValue, newValue);
            });
        },

        setPlaybackQuality: function (type, streamInfo, newPlaybackQuality) {
            var id = streamInfo.id,
                quality = getInternalQuality(type, id),
                isInt = newPlaybackQuality !== null && !isNaN(newPlaybackQuality) && (newPlaybackQuality % 1 === 0);

            if (!isInt) throw "argument is not an integer";

            if (newPlaybackQuality !== quality && newPlaybackQuality >= 0 && topQualities[id].hasOwnProperty(type) && newPlaybackQuality <= topQualities[id][type]) {
                setInternalQuality(type, streamInfo.id, newPlaybackQuality);
                this.notify(this.eventList.ENAME_QUALITY_CHANGED, type, streamInfo, quality, newPlaybackQuality);
            }
        },

        getQualityFor: function (type, streamInfo) {
            return getInternalQuality(type, streamInfo.id);
        },

        getConfidenceFor: function(type, streamInfo) {
            return getInternalConfidence(type, streamInfo.id);
        },

        isPlayingAtTopQuality: function(streamInfo) {
            var self = this,
                isAtTop,
                streamId = streamInfo.id,
                audioQuality = self.getQualityFor("audio", streamInfo),
                videoQuality = self.getQualityFor("video", streamInfo);

            isAtTop = (audioQuality === getTopQualityIndex("audio", streamId)) &&
                (videoQuality === getTopQualityIndex("video", streamId));

            return isAtTop;
        },

        reset: function() {
            var rules = this.abrRulesCollection.getRules(MediaPlayer.rules.ABRRulesCollection.prototype.QUALITY_SWITCH_RULES),
                rule,
                ln = rules.length,
                i = 0;

            for (i; i < ln; i += 1) {
                rule = rules[i];

                if (typeof(rule.reset) === "function") {
                    rule.reset();
                }
            }

            autoSwitchBitrate = true;
            topQualities = {};
            qualityDict = {};
            confidenceDict = {};
        }
    };
};

MediaPlayer.dependencies.AbrController.prototype = {
    constructor: MediaPlayer.dependencies.AbrController
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.BufferController = function () {
    "use strict";
    var STALL_THRESHOLD = 0.5,
        QUOTA_EXCEEDED_ERROR_CODE = 22,
        initializationData = [],
        requiredQuality = 0,
        currentQuality = -1,
        isBufferingCompleted = false,
        bufferLevel = 0,
        criticalBufferLevel = Number.POSITIVE_INFINITY,
        mediaSource,
        maxAppendedIndex = -1,
        lastIndex = -1,
        type,
        buffer = null,
        minBufferTime,
        hasSufficientBuffer = null,
        appendedBytesInfo,

        isBufferLevelOutrun = false,
        isAppendingInProgress = false,
        pendingMedia = [],
        inbandEventFound = false,

        waitingForInit = function() {
            var loadingReqs = this.streamProcessor.getFragmentModel().getLoadingRequests();

            if ((currentQuality > requiredQuality) && (hasReqsForQuality(pendingMedia, currentQuality) || hasReqsForQuality(loadingReqs, currentQuality))) {
                return false;
            }

            return (currentQuality !== requiredQuality);
        },

        hasReqsForQuality = function(arr, quality){
            var i = 0,
                ln = arr.length;

            for (i; i < ln; i +=1) {
                if (arr[i].quality === quality) return true;
            }

            return false;
        },

        sortArrayByProperty = function(array, sortProp) {
            var compare = function (obj1, obj2){
                if (obj1[sortProp] < obj2[sortProp]) return -1;
                if (obj1[sortProp] > obj2[sortProp]) return 1;
                return 0;
            };

            array.sort(compare);
        },

        onInitializationLoaded = function(sender, model, bytes, quality) {
            var self = this;

            if (model !== self.streamProcessor.getFragmentModel()) return;

            self.debug.log("Initialization finished loading: " + type);

            // cache the initialization data to use it next time the quality has changed
            initializationData[quality] = bytes;

            // if this is the initialization data for current quality we need to push it to the buffer

            if (quality !== requiredQuality || !waitingForInit.call(self)) return;

            switchInitData.call(self);
        },

		onMediaLoaded = function (sender, model, bytes, quality, index) {
            if (model !== this.streamProcessor.getFragmentModel()) return;

            var events,
                request = this.streamProcessor.getFragmentModel().getExecutedRequestForQualityAndIndex(quality, index),
                currentTrack = this.streamProcessor.getTrackForQuality(quality),
                eventStreamMedia = this.adapter.getEventsFor(currentTrack.mediaInfo, this.streamProcessor),
                eventStreamTrack = this.adapter.getEventsFor(currentTrack, this.streamProcessor);

            if(eventStreamMedia.length > 0 || eventStreamTrack.length > 0) {
                events = handleInbandEvents.call(this, bytes, request, eventStreamMedia, eventStreamTrack);
                this.streamProcessor.getEventController().addInbandEvents(events);
            }

            bytes = deleteInbandEvents.call(this, bytes);

            pendingMedia.push({bytes: bytes, quality: quality, index: index});
            sortArrayByProperty(pendingMedia, "index");

            appendNext.call(this);
		},

        appendToBuffer = function(data, quality, index) {
            isAppendingInProgress = true;
            appendedBytesInfo = {quality: quality, index: index};

            var self = this,
                isInit = isNaN(index);

            // The fragment should be rejected if this an init fragment and its quality does not match
            // the required quality or if this a media fragment and its quality does not match the
            // quality of the last appended init fragment. This means that media fragment of the old
            // quality can be appended providing init fragment for a new required quality has not been
            // appended yet.
            if ((quality !== requiredQuality && isInit) || (quality !== currentQuality && !isInit)) {
                onMediaRejected.call(self, quality, index);
                return;
            }
            //self.debug.log("Push (" + type + ") bytes: " + data.byteLength);
            self.sourceBufferExt.append(buffer, data);
        },

        onAppended = function(sender, sourceBuffer, data, error) {
            if (buffer !== sourceBuffer) return;

            if (this.isBufferingCompleted() && this.streamProcessor.getStreamInfo().isLast) {
                this.mediaSourceExt.signalEndOfStream(mediaSource);
            }

            var self = this,
                ranges;

            if (error) {
                // if the append has failed because the buffer is full we should store the data
                // that has not been appended and stop request scheduling. We also need to store
                // the promise for this append because the next data can be appended only after
                // this promise is resolved.
                if (error.code === QUOTA_EXCEEDED_ERROR_CODE) {
                    pendingMedia.unshift({bytes: data, quality: appendedBytesInfo.quality, index: appendedBytesInfo.index});
                    criticalBufferLevel = getTotalBufferedTime.call(self) * 0.8;
                    self.notify(self.eventList.ENAME_QUOTA_EXCEEDED, criticalBufferLevel);
                    clearBuffer.call(self);
                }
                isAppendingInProgress = false;
                return;
            }

            updateBufferLevel.call(self);

            if (!hasEnoughSpaceToAppend.call(self)) {
                self.notify(self.eventList.ENAME_QUOTA_EXCEEDED, criticalBufferLevel);
                clearBuffer.call(self);
            }

            ranges = self.sourceBufferExt.getAllRanges(buffer);

            if (ranges) {
                //self.debug.log("Append " + type + " complete: " + ranges.length);
                if (ranges.length > 0) {
                    var i,
                        len;

                    //self.debug.log("Number of buffered " + type + " ranges: " + ranges.length);
                    for (i = 0, len = ranges.length; i < len; i += 1) {
                        self.debug.log("Buffered " + type + " Range: " + ranges.start(i) + " - " + ranges.end(i));
                    }
                }
            }

            onAppendToBufferCompleted.call(self, appendedBytesInfo.quality, appendedBytesInfo.index);
            self.notify(self.eventList.ENAME_BYTES_APPENDED, appendedBytesInfo.quality, appendedBytesInfo.index, ranges);
        },

        updateBufferLevel = function() {
            var self = this,
                currentTime = self.playbackController.getTime();

            bufferLevel = self.sourceBufferExt.getBufferLength(buffer, currentTime);
            self.notify(self.eventList.ENAME_BUFFER_LEVEL_UPDATED, bufferLevel);
            checkGapBetweenBuffers.call(self);
            checkIfSufficientBuffer.call(self);

            if (bufferLevel < STALL_THRESHOLD) {
                notifyIfSufficientBufferStateChanged.call(self, false);
            }

            return true;
        },

        handleInbandEvents = function(data,request,mediaInbandEvents,trackInbandEvents) {
            var events = [],
                i = 0,
                identifier,
                size,
                expTwo = Math.pow(256,2),
                expThree = Math.pow(256,3),
                fragmentStarttime = Math.max(isNaN(request.startTime) ? 0 : request.startTime,0),
                eventStreams = [],
                event,
                inbandEvents;

            inbandEventFound = false;
            /* Extract the possible schemeIdUri : If a DASH client detects an event message box with a scheme that is not defined in MPD, the client is expected to ignore it */
            inbandEvents = mediaInbandEvents.concat(trackInbandEvents);
            for(var loop = 0; loop < inbandEvents.length; loop++) {
                eventStreams[inbandEvents[loop].schemeIdUri] = inbandEvents[loop];
            }
            while(i<data.length) {
                identifier = String.fromCharCode(data[i+4],data[i+5],data[i+6],data[i+7]); // box identifier
                size = data[i]*expThree + data[i+1]*expTwo + data[i+2]*256 + data[i+3]*1; // size of the box
                if( identifier == "moov" || identifier == "moof") {
                    break;
                } else if(identifier == "emsg") {
                    inbandEventFound = true;
                    var eventBox = ["","",0,0,0,0,""],
                        arrIndex = 0,
                        j = i+12; //fullbox header is 12 bytes, thats why we start at 12

                    while(j < size+i) {
                        /* == string terminates with 0, this indicates end of attribute == */
                        if(arrIndex === 0 || arrIndex == 1 || arrIndex == 6) {
                            if(data[j] !== 0) {
                                eventBox[arrIndex] += String.fromCharCode(data[j]);
                            } else {
                                arrIndex += 1;
                            }
                            j += 1;
                        } else {
                            eventBox[arrIndex] = data[j]*expThree + data[j+1]*expTwo + data[j+2]*256 + data[j+3]*1;
                            j += 4;
                            arrIndex += 1;
                        }
                    }

                    event = this.adapter.getEvent(eventBox, eventStreams, fragmentStarttime);

                    if (event) {
                        events.push(event);
                    }
                }
                i += size;
            }

            return events;
        },

        deleteInbandEvents = function(data) {

            if(!inbandEventFound) {
                return data;
            }

            var length = data.length,
                i = 0,
                j = 0,
                identifier,
                size,
                expTwo = Math.pow(256,2),
                expThree = Math.pow(256,3),
                modData = new Uint8Array(data.length);

            while(i<length) {

                identifier = String.fromCharCode(data[i+4],data[i+5],data[i+6],data[i+7]);
                size = data[i]*expThree + data[i+1]*expTwo + data[i+2]*256 + data[i+3]*1;

                if(identifier != "emsg" ) {
                    for(var l = i ; l < i + size; l++) {
                        modData[j] = data[l];
                        j += 1;
                    }
                }
                i += size;

            }

            return modData.subarray(0,j);
        },

        checkGapBetweenBuffers= function() {
            var leastLevel = getLeastBufferLevel.call(this),
                acceptableGap = minBufferTime * 2,
                actualGap = bufferLevel - leastLevel;

            // if the gap betweeen buffers is too big we should create a promise that prevents appending data to the current
            // buffer and requesting new fragments until the gap will be reduced to the suitable size.
            if (actualGap >= acceptableGap && !isBufferLevelOutrun) {
                isBufferLevelOutrun = true;
                this.notify(this.eventList.ENAME_BUFFER_LEVEL_OUTRUN);
            } else if ((actualGap < (acceptableGap / 2) && isBufferLevelOutrun)) {
                this.notify(this.eventList.ENAME_BUFFER_LEVEL_BALANCED);
                isBufferLevelOutrun = false;
                appendNext.call(this);
            }
        },

        getLeastBufferLevel = function() {
            var videoMetrics = this.metricsModel.getReadOnlyMetricsFor("video"),
                videoBufferLevel = this.metricsExt.getCurrentBufferLevel(videoMetrics),
                audioMetrics = this.metricsModel.getReadOnlyMetricsFor("audio"),
                audioBufferLevel = this.metricsExt.getCurrentBufferLevel(audioMetrics),
                leastLevel = null;

            if (videoBufferLevel === null || audioBufferLevel === null) {
                leastLevel = (audioBufferLevel !== null) ? audioBufferLevel.level : ((videoBufferLevel !== null) ? videoBufferLevel.level : null);
            } else {
                leastLevel = Math.min(audioBufferLevel.level, videoBufferLevel.level);
            }

            return leastLevel;
        },

        hasEnoughSpaceToAppend = function() {
            var self = this,
                totalBufferedTime = getTotalBufferedTime.call(self);

            return (totalBufferedTime < criticalBufferLevel);
        },

        clearBuffer = function() {
            var self = this,
                currentTime = self.playbackController.getTime(),
                removeStart,
                removeEnd,
                range,
                req;

            if (!buffer) return;

            // we need to remove data that is more than one fragment before the video currentTime
            req = self.fragmentController.getExecutedRequestForTime(self.streamProcessor.getFragmentModel(), currentTime);
            removeEnd = (req && !isNaN(req.startTime)) ? req.startTime : Math.floor(currentTime);

            range = self.sourceBufferExt.getBufferRange(buffer, currentTime);

            if ((range === null) && (buffer.buffered.length > 0)) {
                removeEnd = buffer.buffered.end(buffer.buffered.length -1 );
            }

            removeStart = buffer.buffered.start(0);
            self.sourceBufferExt.remove(buffer, removeStart, removeEnd, mediaSource);
        },

        onRemoved = function(sender, sourceBuffer, removeStart, removeEnd) {
            if (buffer !== sourceBuffer) return;

            updateBufferLevel.call(this);
            this.notify(this.eventList.ENAME_BUFFER_CLEARED, removeStart, removeEnd, hasEnoughSpaceToAppend.call(this));
            if (hasEnoughSpaceToAppend.call(this)) return;

            setTimeout(clearBuffer.bind(this), minBufferTime * 1000);
        },

        getTotalBufferedTime = function() {
            var self = this,
                ranges = self.sourceBufferExt.getAllRanges(buffer),
                totalBufferedTime = 0,
                ln,
                i;

            if (!ranges) return totalBufferedTime;

            for (i = 0, ln = ranges.length; i < ln; i += 1) {
                totalBufferedTime += ranges.end(i) - ranges.start(i);
            }

            return totalBufferedTime;
        },

        checkIfBufferingCompleted = function() {
            var isLastIdxAppended = maxAppendedIndex === (lastIndex - 1);

            if (!isLastIdxAppended || isBufferingCompleted) return;

            isBufferingCompleted = true;
            this.notify(this.eventList.ENAME_BUFFERING_COMPLETED);
        },

        checkIfSufficientBuffer = function () {
            var timeToEnd = this.playbackController.getTimeToStreamEnd(),
                minLevel = this.streamProcessor.isDynamic() ? minBufferTime / 2 : minBufferTime;

            if ((bufferLevel < minLevel) && ((minBufferTime < timeToEnd) || (minBufferTime >= timeToEnd && !isBufferingCompleted))) {
                notifyIfSufficientBufferStateChanged.call(this, false);
            } else {
                notifyIfSufficientBufferStateChanged.call(this, true);
            }
        },

        notifyIfSufficientBufferStateChanged = function(state) {
            if (hasSufficientBuffer === state) return;

            hasSufficientBuffer = state;

            this.debug.log(hasSufficientBuffer ? ("Got enough " + type + " buffer to start.") : ("Waiting for more " + type + " buffer before starting playback."));

            this.eventBus.dispatchEvent({
                type: hasSufficientBuffer ? "bufferLoaded" : "bufferStalled",
                data: {
                    bufferType: type
                }
            });

            this.notify(this.eventList.ENAME_BUFFER_LEVEL_STATE_CHANGED, state);
        },

        updateBufferTimestampOffset = function(MSETimeOffset) {
            // each track can have its own @presentationTimeOffset, so we should set the offset
            // if it has changed after switching the quality or updating an mpd
            if (buffer.timestampOffset !== MSETimeOffset) {
                buffer.timestampOffset = MSETimeOffset;
            }
        },

        updateBufferState = function() {
            var self = this;

            updateBufferLevel.call(self);
            appendNext.call(self);
        },

        appendNext = function() {
            if (waitingForInit.call(this)) {
                switchInitData.call(this);
            } else {
                appendNextMedia.call(this);
            }
        },

        onAppendToBufferCompleted = function(quality, index) {
            isAppendingInProgress = false;

            if (!isNaN(index)) {
                onMediaAppended.call(this, index);
            } else {
                onInitAppended.call(this, quality);
            }

            appendNext.call(this);
        },

        onMediaRejected = function(quality, index) {
            isAppendingInProgress = false;
            this.notify(this.eventList.ENAME_BYTES_REJECTED, quality, index);
            appendNext.call(this);
        },

        onInitAppended = function(quality) {
            currentQuality = quality;
        },

        onMediaAppended = function(index) {
            maxAppendedIndex = Math.max(index,maxAppendedIndex);
            checkIfBufferingCompleted.call(this);
        },

        appendNextMedia = function() {
            var data;

            if (pendingMedia.length === 0 || isBufferLevelOutrun || isAppendingInProgress || waitingForInit.call(this) || !hasEnoughSpaceToAppend.call(this)) return;

            data = pendingMedia.shift();
            appendToBuffer.call(this, data.bytes, data.quality, data.index);
        },

        onDataUpdateCompleted = function(sender, data, trackData) {
            var self = this,
                bufferLength;

            updateBufferTimestampOffset.call(self, trackData.MSETimeOffset);

            bufferLength = self.streamProcessor.getStreamInfo().manifestInfo.minBufferTime;
            //self.debug.log("Min Buffer time: " + bufferLength);
            if (minBufferTime !== bufferLength) {
                self.setMinBufferTime(bufferLength);
                self.notify(self.eventList.ENAME_MIN_BUFFER_TIME_UPDATED, bufferLength);
            }
        },

        onStreamCompleted = function (sender, model, request) {
            var self = this;

            if (model !== self.streamProcessor.getFragmentModel()) return;

            lastIndex = request.index;
            checkIfBufferingCompleted.call(self);
        },

        onQualityChanged = function(sender, typeValue, streamInfo, oldQuality, newQuality) {
            if (type !== typeValue || this.streamProcessor.getStreamInfo().id !== streamInfo.id) return;

            var self = this;

            // if the quality has changed we should append the initialization data again. We get it
            // from the cached array instead of sending a new request
            if (requiredQuality === newQuality) return;

            updateBufferTimestampOffset.call(self, self.streamProcessor.getTrackForQuality(newQuality).MSETimeOffset);

            requiredQuality = newQuality;
            if (!waitingForInit.call(self)) return;

            switchInitData.call(self);
        },

        switchInitData = function() {
            var self = this;

            if (initializationData[requiredQuality]) {
                if (isAppendingInProgress) return;

                appendToBuffer.call(self, initializationData[requiredQuality], requiredQuality);
            } else {
                // if we have not loaded the init fragment for the current quality, do it
                self.notify(self.eventList.ENAME_INIT_REQUESTED, requiredQuality);
            }
        },

        onWallclockTimeUpdated = function(/*sender*/) {
            appendNext.call(this);
        },

        onPlaybackRateChanged = function(/*sender*/) {
            checkIfSufficientBuffer.call(this);
        };

    return {
        manifestModel: undefined,
        sourceBufferExt: undefined,
        eventBus: undefined,
        bufferMax: undefined,
        mediaSourceExt: undefined,
        metricsModel: undefined,
        metricsExt: undefined,
        adapter: undefined,
        debug: undefined,
        system: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_CLOSED_CAPTIONING_REQUESTED: "closedCaptioningRequested",
            ENAME_BUFFER_LEVEL_STATE_CHANGED: "bufferLevelStateChanged",
            ENAME_BUFFER_LEVEL_UPDATED: "bufferLevelUpdated",
            ENAME_QUOTA_EXCEEDED: "quotaExceeded",
            ENAME_BYTES_APPENDED: "bytesAppended",
            ENAME_BYTES_REJECTED: "bytesRejected",
            ENAME_BUFFERING_COMPLETED: "bufferingCompleted",
            ENAME_BUFFER_CLEARED: "bufferCleared",
            ENAME_INIT_REQUESTED: "initRequested",
            ENAME_BUFFER_LEVEL_OUTRUN: "bufferLevelOutrun",
            ENAME_BUFFER_LEVEL_BALANCED: "bufferLevelBalanced",
            ENAME_MIN_BUFFER_TIME_UPDATED: "minBufferTimeUpdated"
        },

        setup: function() {
            this.dataUpdateCompleted = onDataUpdateCompleted;

            this.initFragmentLoaded = onInitializationLoaded;
            this.mediaFragmentLoaded =  onMediaLoaded;
            this.streamCompleted = onStreamCompleted;

            this.qualityChanged = onQualityChanged;

            this.playbackProgress = updateBufferState;
            this.playbackSeeking = updateBufferState;
            this.playbackTimeUpdated = updateBufferState;
            this.playbackRateChanged = onPlaybackRateChanged;
            this.wallclockTimeUpdated = onWallclockTimeUpdated;

            onAppended = onAppended.bind(this);
            onRemoved = onRemoved.bind(this);
            this.sourceBufferExt.subscribe(this.sourceBufferExt.eventList.ENAME_SOURCEBUFFER_APPEND_COMPLETED, this, onAppended);
            this.sourceBufferExt.subscribe(this.sourceBufferExt.eventList.ENAME_SOURCEBUFFER_REMOVE_COMPLETED, this, onRemoved);
        },

        initialize: function (typeValue, buffer, source, streamProcessor) {
            var self = this;

            type = typeValue;
            self.setMediaSource(source);
            self.setBuffer(buffer);
            self.streamProcessor = streamProcessor;
            self.fragmentController = streamProcessor.fragmentController;
            self.scheduleController = streamProcessor.scheduleController;
            self.playbackController = streamProcessor.playbackController;
        },

        getStreamProcessor: function() {
            return this.streamProcessor;
        },

        setStreamProcessor: function(value) {
            this.streamProcessor = value;
        },

        getBuffer: function () {
            return buffer;
        },

        setBuffer: function (value) {
            buffer = value;
        },

        getBufferLevel: function() {
            return bufferLevel;
        },

        getMinBufferTime: function () {
            return minBufferTime;
        },

        setMinBufferTime: function (value) {
            minBufferTime = value;
        },

        getCriticalBufferLevel: function(){
            return criticalBufferLevel;
        },

        setMediaSource: function(value) {
            mediaSource = value;
        },

        isBufferingCompleted : function() {
            return isBufferingCompleted;
        },

        reset: function(errored) {
            var self = this;

            initializationData = [];
            criticalBufferLevel = Number.POSITIVE_INFINITY;
            hasSufficientBuffer = null;
            minBufferTime = null;
            currentQuality = -1;
            requiredQuality = 0;
            self.sourceBufferExt.unsubscribe(self.sourceBufferExt.eventList.ENAME_SOURCEBUFFER_APPEND_COMPLETED, self, onAppended);
            self.sourceBufferExt.unsubscribe(self.sourceBufferExt.eventList.ENAME_SOURCEBUFFER_REMOVE_COMPLETED, self, onRemoved);
            appendedBytesInfo = null;

            isBufferLevelOutrun = false;
            isAppendingInProgress = false;
            pendingMedia = [];

            if (!errored) {
                self.sourceBufferExt.abort(mediaSource, buffer);
                self.sourceBufferExt.removeSourceBuffer(mediaSource, buffer);
            }

            buffer = null;
        }
    };
};

MediaPlayer.dependencies.BufferController.BUFFER_SIZE_REQUIRED = "required";
MediaPlayer.dependencies.BufferController.BUFFER_SIZE_MIN = "min";
MediaPlayer.dependencies.BufferController.BUFFER_SIZE_INFINITY = "infinity";
MediaPlayer.dependencies.BufferController.DEFAULT_MIN_BUFFER_TIME = 8;
MediaPlayer.dependencies.BufferController.BUFFER_TIME_AT_TOP_QUALITY = 30;
MediaPlayer.dependencies.BufferController.BUFFER_TIME_AT_TOP_QUALITY_LONG_FORM = 300;
MediaPlayer.dependencies.BufferController.LONG_FORM_CONTENT_DURATION_THRESHOLD = 600;

MediaPlayer.dependencies.BufferController.prototype = {
    constructor: MediaPlayer.dependencies.BufferController
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.utils.Capabilities = function () {
    "use strict";
};

MediaPlayer.utils.Capabilities.prototype = {
    constructor: MediaPlayer.utils.Capabilities,

    supportsMediaSource: function () {
        "use strict";

        var hasWebKit = ("WebKitMediaSource" in window),
            hasMediaSource = ("MediaSource" in window);

        return (hasWebKit || hasMediaSource);
    },

    supportsMediaKeys: function () {
        "use strict";

        var hasWebKit = ("WebKitMediaKeys" in window),
            hasMs = ("MSMediaKeys" in window),
            hasMediaSource = ("MediaKeys" in window),
            hasWebkitGenerateKeyRequest = ('webkitGenerateKeyRequest' in document.createElement('video'));

        return (hasWebKit || hasMs || hasMediaSource || hasWebkitGenerateKeyRequest);
    },

    supportsCodec: function (element, codec) {
        "use strict";

        if (!(element instanceof HTMLMediaElement)) {
            throw "element must be of type HTMLMediaElement.";
        }

        var canPlay = element.canPlayType(codec);
        return (canPlay === "probably" || canPlay === "maybe");
    }
};;/**
 * @copyright The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * @license THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * @namespace MediaPlayer.utils.Debug
 *
 */
MediaPlayer.utils.Debug = function () {
    "use strict";

    var logToBrowserConsole = true;

    return {
        eventBus: undefined,
        /**
         * Toggles logging to the browser's javascript console.  If you set to false you will still receive a log event with the same message.
         * @param {boolean} value Set to false if you want to turn off logging to the browser's console.
         * @default true
         * @memberof MediaPlayer.utils.Debug#
         */
        setLogToBrowserConsole: function(value) {
            logToBrowserConsole = value;
        },
        /**
         * Use this method to get the state of logToBrowserConsole.
         * @returns {boolean} The current value of logToBrowserConsole
         * @memberof MediaPlayer.utils.Debug#
         */
        getLogToBrowserConsole: function() {
            return logToBrowserConsole;
        },
        /**
         * This method will allow you send log messages to either the browser's console and/or dispatch an event to capture at the media player level.
         * @param {string} message The message you want to log. (Does not currently support comma separated values.)
         * @memberof MediaPlayer.utils.Debug#
         * @todo - add args... and allow comma separated logging values that will auto concat.
         */
        log: function (message) {
            if (logToBrowserConsole){
                console.log(message);
            }

            this.eventBus.dispatchEvent({
                type: "log",
                message: message
            });
        }
    };
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

MediaPlayer.dependencies.ErrorHandler = function () {
    "use strict";

    return {
        eventBus: undefined,

        // "mediasource"|"mediakeys"
        capabilityError: function (err) {
            this.eventBus.dispatchEvent({
                type: "error",
                error: "capability",
                event: err
            });
        },

        // {id: "manifest"|"SIDX"|"content"|"initialization", url: "", request: {XMLHttpRequest instance}}
        downloadError: function (id, url, request) {
            this.eventBus.dispatchEvent({
                type: "error",
                error: "download",
                event: {id: id, url: url, request: request}
            });
        },

        // {message: "", id: "codec"|"parse"|"nostreams", manifest: {parsed manifest}}
        manifestError: function (message, id, manifest) {
            this.eventBus.dispatchEvent({
                type: "error",
                error: "manifestError",
                event: {message: message, id: id, manifest: manifest}
            });
        },

        closedCaptionsError: function (message, id, ccContent) {
            this.eventBus.dispatchEvent({
                type: "error",
                error: "cc",
                event: {message: message, id: id, cc: ccContent}
            });
        },

        mediaSourceError: function (err) {
            this.eventBus.dispatchEvent({
                type: "error",
                error: "mediasource",
                event: err
            });
        },

        mediaKeySessionError: function (err) {
            this.eventBus.dispatchEvent({
                type: "error",
                error: "key_session",
                event: err
            });
        },

        mediaKeyMessageError: function (err) {
            this.eventBus.dispatchEvent({
                type: "error",
                error: "key_message",
                event: err
            });
        },

        mediaKeySystemSelectionError: function (err) {
            this.eventBus.dispatchEvent({
                type: "error",
                error: "key_system_selection",
                event: err
            });
        }
    };
};

MediaPlayer.dependencies.ErrorHandler.prototype = {
    constructor: MediaPlayer.dependencies.ErrorHandler
};
;MediaPlayer.utils.EventBus = function () {
    "use strict";

    var registrations,

        getListeners = function (type, useCapture) {
            var captype = (useCapture? '1' : '0') + type;

            if (!(captype in registrations)) {
                registrations[captype]= [];
            }

            return registrations[captype];
        },

        init = function () {
            registrations = {};
        };

    init();

    return {
        addEventListener: function (type, listener, useCapture) {
            var listeners = getListeners(type, useCapture);
            var idx = listeners.indexOf(listener);
            if (idx === -1) {
                listeners.push(listener);
            }
        },

        removeEventListener: function (type, listener, useCapture) {
            var listeners = getListeners(type, useCapture);
            var idx= listeners.indexOf(listener);
            if (idx !== -1) {
                listeners.splice(idx, 1);
            }
        },

        dispatchEvent: function (evt) {
            var listeners = getListeners(evt.type, false).slice();
            for (var i= 0; i < listeners.length; i++) {
                listeners[i].call(this, evt);
            }
            return !evt.defaultPrevented;
        }
    };
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Fraunhofer Fokus
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.EventController = function(){
    "use strict";


    var inlineEvents = [], // Holds all Inline Events not triggered yet
        inbandEvents = [], // Holds all Inband Events not triggered yet
        activeEvents = [], // Holds all Events currently running
        eventInterval = null, // variable holding the setInterval
        refreshDelay = 100, // refreshTime for the setInterval
        presentationTimeThreshold = refreshDelay / 1000,
        MPD_RELOAD_SCHEME = "urn:mpeg:dash:event:2012",
        MPD_RELOAD_VALUE = 1,

        reset = function() {
            if(eventInterval !== null) {
                clearInterval(eventInterval);
                eventInterval = null;
            }
            inlineEvents = null;
            inbandEvents = null;
            activeEvents = null;
        },

        clear = function() {
            if(eventInterval !== null) {
                clearInterval(eventInterval);
                eventInterval = null;
            }
        },

        start = function () {
            var self = this;

            self.debug.log("Start Event Controller");
            if (!isNaN(refreshDelay)) {
                eventInterval = setInterval(onEventTimer.bind(this), refreshDelay);
            }
        },

        /**
         * Add events to the eventList. Events that are not in the mpd anymore but not triggered yet will still be deleted
         * @param values
         */
        addInlineEvents = function(values) {
            var self = this;
            inlineEvents = [];

            if(values && values.length > 0){
                inlineEvents = values;
            }
            self.debug.log("Added "+values.length+ " inline events");
        },

        /**
         * i.e. processing of any one event message box with the same id is sufficient
         * @param values
         */
        addInbandEvents = function(values) {
            var self = this;
            for(var i=0;i<values.length;i++) {
                var event = values[i];
                inbandEvents[event.id] = event;
                self.debug.log("Add inband event with id "+event.id);
            }
        },

        /**
         * Itereate through the eventList and trigger/remove the events
         */
        onEventTimer = function () {
            triggerEvents.call(this,inbandEvents);
            triggerEvents.call(this,inlineEvents);
            removeEvents.call(this);
        },

        triggerEvents = function(events) {
            var self = this,
                currentVideoTime = this.videoModel.getCurrentTime(),
                presentationTime;

            /* == Trigger events that are ready == */
            if(events) {
                for (var j = 0; j < events.length; j++) {
                    var curr = events[j];

                    if (curr !== undefined) {
                        presentationTime = curr.presentationTime / curr.eventStream.timescale;
                        if (presentationTime === 0 || (presentationTime <= currentVideoTime && presentationTime + presentationTimeThreshold > currentVideoTime)) {
                            self.debug.log("Start Event at " + currentVideoTime);
                            if (curr.duration > 0) activeEvents.push(curr);
                            if (curr.eventStream.schemeIdUri == MPD_RELOAD_SCHEME && curr.eventStream.value == MPD_RELOAD_VALUE) refreshManifest.call(this);
                            events.splice(j, 1);
                        }
                    }
                }
            }
        },

        /**
         * Remove events from the list that are over
         */
        removeEvents = function() {
            var self = this;

            if(activeEvents) {
                var currentVideoTime = this.videoModel.getCurrentTime();

                for (var i = 0; i < activeEvents.length; i++) {
                    var curr = activeEvents[i];
                    if (curr !== null && (curr.duration + curr.presentationTime) / curr.eventStream.timescale < currentVideoTime) {
                        self.debug.log("Remove Event at time " + currentVideoTime);
                        curr = null;
                        activeEvents.splice(i, 1);
                    }
                }
            }

        },

        refreshManifest = function () {
            var self = this,
                manifest = self.manifestModel.getValue(),
                url = manifest.url;

            if (manifest.hasOwnProperty("Location")) {
                url = manifest.Location;
            }
            self.debug.log("Refresh manifest @ " + url);
            self.manifestLoader.load(url);
        };

    return {
        manifestModel: undefined,
        manifestLoader:undefined,
        debug: undefined,
        system: undefined,
        errHandler: undefined,
        videoModel:undefined,
        addInlineEvents : addInlineEvents,
        addInbandEvents : addInbandEvents,
        reset : reset,
        clear : clear,
        start: start,
        getVideoModel: function() {
            return this.videoModel;
        },
        setVideoModel:function(value) {
            this.videoModel = value;
        },
        initialize:function(videoModel) {
            this.setVideoModel(videoModel);
        }
    };

};

MediaPlayer.dependencies.EventController.prototype = {
    constructor: MediaPlayer.dependencies.EventController
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.FragmentController = function () {
    "use strict";

    var fragmentModels = [],
        inProgress = false,

        findModel = function(context) {
            var ln = fragmentModels.length;
            // We expect one-to-one relation between FragmentModel and context,
            // so just compare the given context object with the one that stored in the model to find the model for it
            for (var i = 0; i < ln; i++) {
                if (fragmentModels[i].getContext() == context) {
                    return fragmentModels[i];
                }
            }

            return null;
        },

        getRequestsToLoad = function(current, callback) {
            var self =this,
                streamProcessor = fragmentModels[0].getContext().streamProcessor,
                streamId = streamProcessor.getStreamInfo().id,
                rules = self.scheduleRulesCollection.getRules(MediaPlayer.rules.ScheduleRulesCollection.prototype.FRAGMENTS_TO_EXECUTE_RULES);

            if (rules.indexOf(this.scheduleRulesCollection.sameTimeRequestRule) !== -1) {
                this.scheduleRulesCollection.sameTimeRequestRule.setFragmentModels(fragmentModels, streamId);
            }

            self.rulesController.applyRules(rules, streamProcessor, callback, current, function(currentValue, newValue) {
                return newValue;
            });
        },

        onFragmentLoadingStart = function(sender, request) {
            var self = this;

            if (self.isInitializationRequest(request)) {
                self.notify(self.eventList.ENAME_INIT_FRAGMENT_LOADING_START, sender, request);
            }else {
                self.notify(self.eventList.ENAME_MEDIA_FRAGMENT_LOADING_START, sender, request);
            }
        },

        onFragmentLoadingCompleted = function(sender, request, response) {
            var self = this,
                bytes = self.process(response);

            if (bytes === null) {
                self.debug.log("No " + request.mediaType + " bytes to push.");
                return;
            }

            if (self.isInitializationRequest(request)) {
                self.notify(self.eventList.ENAME_INIT_FRAGMENT_LOADED, sender, bytes, request.quality);
            }else {
                self.notify(self.eventList.ENAME_MEDIA_FRAGMENT_LOADED, sender, bytes, request.quality, request.index);
            }

            executeRequests.call(this);
        },

        onStreamCompleted = function(sender, request) {
            this.notify(this.eventList.ENAME_STREAM_COMPLETED, sender, request);
        },

        onBufferLevelBalanced = function(/*sender*/) {
            executeRequests.call(this);
        },

        onGetRequests = function(result) {
            var reqsToExecute = result.value,
                mediaType,
                r,
                m,
                i,
                j;

            for (i = 0; i < reqsToExecute.length; i += 1) {
                r = reqsToExecute[i];

                if (!r) continue;

                for (j = 0; j < fragmentModels.length; j += 1) {
                    m = fragmentModels[j];
                    mediaType = m.getContext().streamProcessor.getType();

                    if (r.mediaType !== mediaType) continue;

                    if (!(r instanceof MediaPlayer.vo.FragmentRequest)) {
                        r = m.getPendingRequestForTime(r.startTime);
                    }

                    m.executeRequest(r);
                }
            }

            inProgress = false;
        },

        executeRequests = function(request) {
            if (inProgress) return;

            inProgress = true;

            getRequestsToLoad.call(this, request, onGetRequests.bind(this));
        };

    return {
        system: undefined,
        debug: undefined,
        scheduleRulesCollection: undefined,
        rulesController: undefined,
        fragmentLoader: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_STREAM_COMPLETED: "streamCompleted",
            ENAME_INIT_FRAGMENT_LOADING_START: "initFragmentLoadingStart",
            ENAME_MEDIA_FRAGMENT_LOADING_START: "mediaFragmentLoadingStart",
            ENAME_INIT_FRAGMENT_LOADED: "initFragmentLoaded",
            ENAME_MEDIA_FRAGMENT_LOADED: "mediaFragmentLoaded"
        },

        setup: function() {
            this.fragmentLoadingStarted = onFragmentLoadingStart;
            this.fragmentLoadingCompleted = onFragmentLoadingCompleted;
            this.streamCompleted = onStreamCompleted;

            this.bufferLevelBalanced = onBufferLevelBalanced;
        },

        process: function (bytes) {
            var result = null;

            if (bytes !== null && bytes !== undefined && bytes.byteLength > 0) {
                result = new Uint8Array(bytes);
            }

            return result;
        },

        getModel: function(context) {
            if (!context) return null;
            // Wrap the buffer controller into model and store it to track the loading state and execute the requests
            var model = findModel(context);

            if (!model){
                model = this.system.getObject("fragmentModel");
                model.setContext(context);
                fragmentModels.push(model);
            }

            return model;
        },

        detachModel: function(model) {
            var idx = fragmentModels.indexOf(model);
            // If we have the model for the given buffer just remove it from array
            if (idx > -1) {
                fragmentModels.splice(idx, 1);
            }
        },

        isFragmentLoadedOrPending: function(context, request) {
            var fragmentModel = findModel(context),
                isLoaded;

            if (!fragmentModel) {
                return false;
            }

            isLoaded = fragmentModel.isFragmentLoadedOrPending(request);

            return isLoaded;
        },

        getPendingRequests: function(context) {
            var fragmentModel = findModel(context);

            if (!fragmentModel) {
                return null;
            }

            return fragmentModel.getPendingRequests();
        },

        getLoadingRequests: function(context) {
            var fragmentModel = findModel(context);

            if (!fragmentModel) {
                return null;
            }

            return fragmentModel.getLoadingRequests();
        },

		isInitializationRequest: function(request){
			return (request && request.type && request.type.toLowerCase().indexOf("initialization") !== -1);
		},

        getLoadingTime: function(context) {
            var fragmentModel = findModel(context);

            if (!fragmentModel) {
                return null;
            }

            return fragmentModel.getLoadingTime();
        },

        getExecutedRequestForTime: function(model, time) {
            if (model) {
                return model.getExecutedRequestForTime(time);
            }

            return null;
        },

        removeExecutedRequest: function(model, request) {
            if (model) {
                model.removeExecutedRequest(request);
            }
        },

        removeExecutedRequestsBeforeTime: function(model, time) {
            if (model) {
                model.removeExecutedRequestsBeforeTime(time);
            }
        },

        cancelPendingRequestsForModel: function(model) {
            if (model) {
                model.cancelPendingRequests();
            }
        },

        abortRequestsForModel: function(model) {
            if (model) {
                model.abortRequests();
            }

            executeRequests.call(this);
        },

        prepareFragmentForLoading: function(context, request) {
            var fragmentModel = findModel(context);

            if (!fragmentModel || !request) return;
            // Store the request and all the necessary callbacks in the model for deferred execution
            if (fragmentModel.addRequest(request)) {
                executeRequests.call(this, request);
            }
        },

        executePendingRequests: function() {
            executeRequests.call(this);
        },

        resetModel: function(model) {
            this.abortRequestsForModel(model);
            this.cancelPendingRequestsForModel(model);
        }
    };
};

MediaPlayer.dependencies.FragmentController.prototype = {
    constructor: MediaPlayer.dependencies.FragmentController
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.FragmentLoader = function () {
    "use strict";

    var RETRY_ATTEMPTS = 3,
        RETRY_INTERVAL = 500,
        xhrs = [],

        doLoad = function (request, remainingAttempts) {
            var req = new XMLHttpRequest(),
                httpRequestMetrics = null,
                firstProgress = true,
                needFailureReport = true,
                lastTraceTime = null,
                self = this;

                xhrs.push(req);
                request.requestStartDate = new Date();

                httpRequestMetrics = self.metricsModel.addHttpRequest(request.mediaType,
                                                                      null,
                                                                      request.type,
                                                                      request.url,
                                                                      null,
                                                                      request.range,
                                                                      request.requestStartDate,
                                                                      null,
                                                                      null,
                                                                      null,
                                                                      null,
                                                                      request.duration);

                self.metricsModel.appendHttpTrace(httpRequestMetrics,
                                                  request.requestStartDate,
                                                  request.requestStartDate.getTime() - request.requestStartDate.getTime(),
                                                  [0]);
                lastTraceTime = request.requestStartDate;

                req.open("GET", self.tokenAuthentication.addTokenAsQueryArg(request.url), true);
                req.responseType = "arraybuffer";
                req = self.tokenAuthentication.setTokenInRequestHeader(req);
/*
                req.setRequestHeader("Cache-Control", "no-cache");
                req.setRequestHeader("Pragma", "no-cache");
                req.setRequestHeader("If-Modified-Since", "Sat, 1 Jan 2000 00:00:00 GMT");
*/
                if (request.range) {
                    req.setRequestHeader("Range", "bytes=" + request.range);
                }

                req.onprogress = function (event) {
                    var currentTime = new Date();
                    if (firstProgress) {
                        firstProgress = false;
                        if (!event.lengthComputable || (event.lengthComputable && event.total != event.loaded)) {
                            request.firstByteDate = currentTime;
                            httpRequestMetrics.tresponse = currentTime;
                        }
                    }
                    self.metricsModel.appendHttpTrace(httpRequestMetrics,
                                                      currentTime,
                                                      currentTime.getTime() - lastTraceTime.getTime(),
                                                      [req.response ? req.response.byteLength : 0]);
                    lastTraceTime = currentTime;
                };

                req.onload = function () {
                    if (req.status < 200 || req.status > 299)
                    {
                      return;
                    }
                    needFailureReport = false;

                    var currentTime = new Date(),
                        bytes = req.response,
                        latency,
                        download;

                    if (!request.firstByteDate) {
                        request.firstByteDate = request.requestStartDate;
                    }
                    request.requestEndDate = currentTime;

                    latency = (request.firstByteDate.getTime() - request.requestStartDate.getTime());
                    download = (request.requestEndDate.getTime() - request.firstByteDate.getTime());

                    self.debug.log("loaded " + request.mediaType + ":" + request.type + ":" + request.startTime + " (" + req.status + ", " + latency + "ms, " + download + "ms)");

                    httpRequestMetrics.tresponse = request.firstByteDate;
                    httpRequestMetrics.tfinish = request.requestEndDate;
                    httpRequestMetrics.responsecode = req.status;

                    self.metricsModel.appendHttpTrace(httpRequestMetrics,
                                                      currentTime,
                                                      currentTime.getTime() - lastTraceTime.getTime(),
                                                      [bytes ? bytes.byteLength : 0]);
                    lastTraceTime = currentTime;

                    self.notify(self.eventList.ENAME_LOADING_COMPLETED, request, bytes);
                };

                req.onloadend = req.onerror = function () {
                    if (xhrs.indexOf(req) === -1) {
                        return;
                    } else {
                        xhrs.splice(xhrs.indexOf(req), 1);
                    }

                    if (!needFailureReport)
                    {
                      return;
                    }
                    needFailureReport = false;

                    var currentTime = new Date(),
                        bytes = req.response,
                        latency,
                        download;

                    if (!request.firstByteDate) {
                        request.firstByteDate = request.requestStartDate;
                    }
                    request.requestEndDate = currentTime;

                    latency = (request.firstByteDate.getTime() - request.requestStartDate.getTime());
                    download = (request.requestEndDate.getTime() - request.firstByteDate.getTime());

                    self.debug.log("failed " + request.mediaType + ":" + request.type + ":" + request.startTime + " (" + req.status + ", " + latency + "ms, " + download + "ms)");

                    httpRequestMetrics.tresponse = request.firstByteDate;
                    httpRequestMetrics.tfinish = request.requestEndDate;
                    httpRequestMetrics.responsecode = req.status;

                    self.metricsModel.appendHttpTrace(httpRequestMetrics,
                                                      currentTime,
                                                      currentTime.getTime() - lastTraceTime.getTime(),
                                                      [bytes ? bytes.byteLength : 0]);
                    lastTraceTime = currentTime;


                    if (remainingAttempts > 0) {
                        self.debug.log("Failed loading fragment: " + request.mediaType + ":" + request.type + ":" + request.startTime + ", retry in " + RETRY_INTERVAL + "ms" + " attempts: " + remainingAttempts);
                        remainingAttempts--;
                        setTimeout(function() {
                            doLoad.call(self, request, remainingAttempts);
                        }, RETRY_INTERVAL);
                    } else {
                        self.debug.log("Failed loading fragment: " + request.mediaType + ":" + request.type + ":" + request.startTime + " no retry attempts left");
                        self.errHandler.downloadError("content", request.url, req);
                        self.notify(self.eventList.ENAME_LOADING_COMPLETED, request, null, new Error("failed loading fragment"));
                    }
                };

                req.send();
        },

        checkForExistence = function(request) {
            var self = this,
                req = new XMLHttpRequest(),
                isSuccessful = false;

            req.open("HEAD", request.url, true);

            req.onload = function () {
                if (req.status < 200 || req.status > 299) return;

                isSuccessful = true;

                self.notify(self.eventList.ENAME_CHECK_FOR_EXISTENCE_COMPLETED, true, request);
            };

            req.onloadend = req.onerror = function () {
                if (isSuccessful) return;

                self.notify(self.eventList.ENAME_CHECK_FOR_EXISTENCE_COMPLETED, false, request);
            };

            req.send();
        };

    return {
        metricsModel: undefined,
        errHandler: undefined,
        debug: undefined,
        tokenAuthentication:undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_LOADING_COMPLETED: "loadingCompleted",
            ENAME_CHECK_FOR_EXISTENCE_COMPLETED: "checkForExistenceCompleted"
        },

        load: function (req) {

            if (!req) {
                this.notify(this.eventList.ENAME_LOADING_COMPLETED, req, null, new Error("request is null"));
            } else {
                doLoad.call(this, req, RETRY_ATTEMPTS);
            }
        },

        checkForExistence: function(req) {
            if (!req) {
                this.notify(this.eventList.ENAME_CHECK_FOR_EXISTENCE_COMPLETED, false, req);
                return;
            }

            checkForExistence.call(this, req);
        },

        abort: function() {
            var i,
                req,
                ln = xhrs.length;

            for (i = 0; i < ln; i +=1) {
                req = xhrs[i];
                xhrs[i] = null;
                req.abort();
                req = null;
            }

            xhrs = [];
        }
    };
};

MediaPlayer.dependencies.FragmentLoader.prototype = {
    constructor: MediaPlayer.dependencies.FragmentLoader
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

MediaPlayer.dependencies.FragmentModel = function () {
    "use strict";

    var context,
        executedRequests = [],
        pendingRequests = [],
        loadingRequests = [],
        rejectedRequests = [],

        isLoadingPostponed = false,

        loadCurrentFragment = function(request) {
            var self = this;

            // We are about to start loading the fragment, so execute the corresponding callback
            self.notify(self.eventList.ENAME_FRAGMENT_LOADING_STARTED, request);
            self.fragmentLoader.load(request);
        },

        removeExecutedRequest = function(request) {
            var idx = executedRequests.indexOf(request);

            if (idx !== -1) {
                executedRequests.splice(idx, 1);
            }
        },

        getRequestForTime = function(arr, time) {
            var lastIdx = arr.length - 1,
                THRESHOLD = 0.001,
                start = NaN,
                end = NaN,
                req = null,
                i;

            // loop through the executed requests and pick the one for which the playback interval matches the given time
            for (i = lastIdx; i >= 0; i -=1) {
                req = arr[i];
                start = req.startTime;
                end = start + req.duration;
                if ((!isNaN(start) && !isNaN(end) && ((time + THRESHOLD) >= start) && (time < end)) || (isNaN(start) && isNaN(time))) {
                    return req;
                }
            }

            return null;
        },

        addSchedulingInfoMetrics = function(request, state) {
            if (!request) return;

            var mediaType = request.mediaType,
                now = new Date(),
                type = request.type,
                startTime = request.startTime,
                availabilityStartTime = request.availabilityStartTime,
                duration = request.duration,
                quality = request.quality,
                range = request.range;

            this.metricsModel.addSchedulingInfo(mediaType, now, type, startTime, availabilityStartTime, duration, quality, range, state);
        },

        onLoadingCompleted = function(sender, request, response, error) {
            loadingRequests.splice(loadingRequests.indexOf(request), 1);

            if (response && !error) {
                executedRequests.push(request);
                addSchedulingInfoMetrics.call(this, request, MediaPlayer.vo.metrics.SchedulingInfo.EXECUTED_STATE);
                this.notify(this.eventList.ENAME_FRAGMENT_LOADING_COMPLETED, request, response);
            } else {
                addSchedulingInfoMetrics.call(this, request, MediaPlayer.vo.metrics.SchedulingInfo.FAILED_STATE);
                this.notify(this.eventList.ENAME_FRAGMENT_LOADING_FAILED, request);
            }
        },

        onBytesRejected = function(sender, quality, index) {
            var req = this.getExecutedRequestForQualityAndIndex(quality, index);
            // if request for an unappropriate quality has not been removed yet, do it now
            if (req) {
                this.removeExecutedRequest(req);
                // if index is not a number it means that this is a media fragment, so we should
                // request the fragment for the same time but with an appropriate quality
                // If this is init fragment do nothing, because it will be requested in loadInitialization method
                if (!isNaN(index)) {
                    rejectedRequests.push(req);
                    addSchedulingInfoMetrics.call(this, req, MediaPlayer.vo.metrics.SchedulingInfo.REJECTED_STATE);
                }
            }
        },

        onBufferLevelOutrun = function() {
            isLoadingPostponed = true;
        },

        onBufferLevelBalanced = function() {
            isLoadingPostponed = false;
        };

    return {
        system: undefined,
        debug: undefined,
        metricsModel: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_STREAM_COMPLETED: "streamCompleted",
            ENAME_FRAGMENT_LOADING_STARTED: "fragmentLoadingStarted",
            ENAME_FRAGMENT_LOADING_COMPLETED: "fragmentLoadingCompleted",
            ENAME_FRAGMENT_LOADING_FAILED: "fragmentLoadingFailed"
        },

        setup: function() {
            this.bufferLevelOutrun = onBufferLevelOutrun;
            this.bufferLevelBalanced = onBufferLevelBalanced;
            this.bytesRejected = onBytesRejected;
            this.loadingCompleted = onLoadingCompleted;
        },

        setLoader: function(value) {
            this.fragmentLoader = value;
        },

        setContext: function(value) {
            context = value;
        },

        getContext: function() {
            return context;
        },

        getIsPostponed: function() {
            return isLoadingPostponed;
        },

        addRequest: function(value) {
            if (!value || this.isFragmentLoadedOrPending(value)) return false;

            pendingRequests.push(value);
            addSchedulingInfoMetrics.call(this, value, MediaPlayer.vo.metrics.SchedulingInfo.PENDING_STATE);

            return true;
        },

        isFragmentLoadedOrPending: function(request) {
            var isEqualComplete = function(req1, req2) {
                    return ((req1.action === "complete") && (req1.action === req2.action));
                },

                isEqualMedia = function(req1, req2) {
                    return ((req1.url === req2.url) && (req1.startTime === req2.startTime));
                },

                isEqualInit = function(req1, req2) {
                    return isNaN(req1.index) && isNaN(req2.index) && (req1.quality === req2.quality);
                },

                check = function(arr) {
                    var req,
                        isLoaded = false,
                        ln = arr.length,
                        i;

                    for (i = 0; i < ln; i += 1) {
                        req = arr[i];

                        if (isEqualMedia(request, req) || isEqualInit(request, req) || isEqualComplete(request, req)) {
                            //self.debug.log(request.mediaType + " Fragment already loaded for time: " + request.startTime);
                            isLoaded = true;
                            break;
                        }
                    }

                    return isLoaded;
                };

            return (check(pendingRequests) || check(loadingRequests) || check(executedRequests));
        },

        getPendingRequests: function() {
            return pendingRequests;
        },

        getLoadingRequests: function() {
            return loadingRequests;
        },

        getExecutedRequests: function() {
            return executedRequests;
        },

        getRejectedRequests: function() {
            return rejectedRequests;
        },

        getLoadingTime: function() {
            var loadingTime = 0,
                req,
                i;

            // get the latest loaded request and calculate its loading time. In case requestEndDate/firstByteDate properties
            // have not been set (e.g. for a request with action='complete') we should get the previous request.
            for (i = executedRequests.length - 1; i >= 0; i -= 1) {
                req = executedRequests[i];

                if ((req.requestEndDate instanceof Date) && (req.firstByteDate instanceof Date)) {
                    loadingTime = req.requestEndDate.getTime() - req.firstByteDate.getTime();
                    break;
                }
            }

            return loadingTime;
        },

        getExecutedRequestForTime: function(time) {
            return getRequestForTime(executedRequests, time);
        },

        getPendingRequestForTime: function(time) {
            return getRequestForTime(pendingRequests, time);
        },

        getLoadingRequestForTime: function(time) {
            return getRequestForTime(loadingRequests, time);
        },

        getExecutedRequestForQualityAndIndex: function(quality, index) {
            var lastIdx = executedRequests.length - 1,
                req = null,
                i;

            for (i = lastIdx; i >= 0; i -=1) {
                req = executedRequests[i];
                if ((req.quality === quality) && (req.index === index)) {
                    return req;
                }
            }

            return null;
        },

        removeExecutedRequest: function(request) {
            removeExecutedRequest.call(this, request);
        },

        removeExecutedRequestsBeforeTime: function(time) {
            var lastIdx = executedRequests.length - 1,
                start = NaN,
                req = null,
                i;

            // loop through the executed requests and remove the ones for which startTime is less than the given time
            for (i = lastIdx; i >= 0; i -=1) {
                req = executedRequests[i];
                start = req.startTime;
                if (!isNaN(start) && (start < time)) {
                    removeExecutedRequest.call(this, req);
                }
            }
        },

        cancelPendingRequests: function(quality) {
            var self = this,
                reqs = pendingRequests,
                canceled = reqs;

            pendingRequests = [];

            if (quality !== undefined) {
                pendingRequests = reqs.filter(function(request) {
                    if (request.quality === quality) {
                        return false;
                    }

                    canceled.splice(canceled.indexOf(request), 1);
                    return true;
                });
            }

            canceled.forEach(function(request) {
                addSchedulingInfoMetrics.call(self, request, MediaPlayer.vo.metrics.SchedulingInfo.CANCELED_STATE);
            });

            return canceled;
        },

        abortRequests: function() {
            this.fragmentLoader.abort();

            for (var i = 0, ln = loadingRequests.length; i < ln; i += 1) {
                this.removeExecutedRequest(loadingRequests[i]);
            }

            loadingRequests = [];
        },

        executeRequest: function(request) {
            var self = this,
                idx = pendingRequests.indexOf(request);

            if (!request || idx === -1) return;

            pendingRequests.splice(idx, 1);

            switch (request.action) {
                case "complete":
                    // Stream has completed, execute the correspoinding callback
                    executedRequests.push(request);
                    addSchedulingInfoMetrics.call(self, request, MediaPlayer.vo.metrics.SchedulingInfo.EXECUTED_STATE);
                    self.notify(self.eventList.ENAME_STREAM_COMPLETED, request);
                    break;
                case "download":
                    loadingRequests.push(request);
                    addSchedulingInfoMetrics.call(self, request, MediaPlayer.vo.metrics.SchedulingInfo.LOADING_STATE);
                    loadCurrentFragment.call(self, request);
                    break;
                default:
                    this.debug.log("Unknown request action.");
            }
        }
    };
};

MediaPlayer.dependencies.FragmentModel.prototype = {
    constructor: MediaPlayer.dependencies.FragmentModel
};;
MediaPlayer.dependencies.LiveEdgeFinder = function () {
    "use strict";

    var isSearchStarted = false,
        rules,

        onSearchCompleted = function(req) {
            var liveEdge = req.value,
                searchTime = (new Date().getTime() - this.streamProcessor.getStreamInfo().manifestInfo.loadedTime.getTime()) / 1000;

            if (liveEdge !== null) {
                this.notify(this.eventList.ENAME_LIVE_EDGE_FOUND, liveEdge, searchTime);
            } else {
                this.notify(this.eventList.ENAME_LIVE_EDGE_SEARCH_ERROR, searchTime);
            }
        },

        onStreamUpdated = function(/*sender*/) {
            if (!this.streamProcessor.isDynamic() || isSearchStarted) return;

            var self = this;

            rules = self.scheduleRulesCollection.getRules(MediaPlayer.rules.ScheduleRulesCollection.prototype.LIVE_EDGE_RULES);
            isSearchStarted = true;

            this.rulesController.applyRules(rules, self.streamProcessor, onSearchCompleted.bind(self), null, function(currentValue, newValue) {
                return newValue;
            });
        };

    return {
        system: undefined,
        scheduleRulesCollection: undefined,
        rulesController: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_LIVE_EDGE_FOUND: "liveEdgeFound",
            ENAME_LIVE_EDGE_SEARCH_ERROR: "liveEdgeSearchError"
        },

        setup: function() {
            this.streamUpdated = onStreamUpdated;
        },

        initialize: function(streamProcessor) {
            this.streamProcessor = streamProcessor;
            this.fragmentLoader = streamProcessor.fragmentLoader;

            if (this.scheduleRulesCollection.liveEdgeBinarySearchRule) {
                this.scheduleRulesCollection.liveEdgeBinarySearchRule.setFinder(this);
            }
        },

        abortSearch: function() {
            isSearchStarted = false;

            if (!rules) return;

            for (var i = 0, ln = rules.length; i < ln; i += 1) {
                rules[i].reset();
            }
        }
    };
};

MediaPlayer.dependencies.LiveEdgeFinder.prototype = {
    constructor: MediaPlayer.dependencies.LiveEdgeFinder
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.ManifestLoader = function () {
    "use strict";

    var RETRY_ATTEMPTS = 3,
        RETRY_INTERVAL = 500,
        parseBaseUrl = function (url) {
            var base = null;

            if (url.indexOf("/") !== -1)
            {
                if (url.indexOf("?") !== -1) {
                    url = url.substring(0, url.indexOf("?"));
                }
                base = url.substring(0, url.lastIndexOf("/") + 1);
            }

            return base;
        },

        doLoad = function (url, remainingAttempts) {
            var baseUrl = parseBaseUrl(url),
                request = new XMLHttpRequest(),
                requestTime = new Date(),
                loadedTime = null,
                needFailureReport = true,
                manifest,
                onload = null,
                report = null,
                self = this;


            onload = function () {
                if (request.status < 200 || request.status > 299)
                {
                  return;
                }
                needFailureReport = false;
                loadedTime = new Date();

                self.tokenAuthentication.checkRequestHeaderForToken(request);
                self.metricsModel.addHttpRequest("stream",
                                                 null,
                                                 "MPD",
                                                 url,
                                                 null,
                                                 null,
                                                 requestTime,
                                                 loadedTime,
                                                 request.status,
                                                 null,
                                                 null);

                manifest = self.parser.parse(request.responseText, baseUrl);

                if (manifest) {
                    manifest.url = url;
                    manifest.loadedTime = loadedTime;
                    self.metricsModel.addManifestUpdate("stream", manifest.type, requestTime, loadedTime, manifest.availabilityStartTime);
                    self.notify(self.eventList.ENAME_MANIFEST_LOADED, manifest);
                } else {
                    self.notify(self.eventList.ENAME_MANIFEST_LOADED, null, new Error("Failed loading manifest: " + url));
                }
            };

            report = function () {
                if (!needFailureReport)
                {
                  return;
                }
                needFailureReport = false;

                self.metricsModel.addHttpRequest("stream",
                                                 null,
                                                 "MPD",
                                                 url,
                                                 null,
                                                 null,
                                                 requestTime,
                                                 new Date(),
                                                 request.status,
                                                 null,
                                                 null);
                if (remainingAttempts > 0) {
                    self.debug.log("Failed loading manifest: " + url + ", retry in " + RETRY_INTERVAL + "ms" + " attempts: " + remainingAttempts);
                    remainingAttempts--;
                    setTimeout(function() {
                        doLoad.call(self, url, remainingAttempts);
                    }, RETRY_INTERVAL);
                } else {
                    self.debug.log("Failed loading manifest: " + url + " no retry attempts left");
                    self.errHandler.downloadError("manifest", url, request);
                    self.notify(self.eventList.ENAME_MANIFEST_LOADED, null, new Error("Failed loading manifest: " + url + " no retry attempts left"));
                }
            };

            try {
                //this.debug.log("Start loading manifest: " + url);
                request.onload = onload;
                request.onloadend = report;
                request.onerror = report;
                request.open("GET", url, true);
                request.send();
            } catch(e) {
                request.onerror();
            }
        };

    return {
        debug: undefined,
        parser: undefined,
        errHandler: undefined,
        metricsModel: undefined,
        tokenAuthentication:undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_MANIFEST_LOADED: "manifestLoaded"
        },

        load: function(url) {
            doLoad.call(this, url, RETRY_ATTEMPTS);
        }
    };
};

MediaPlayer.dependencies.ManifestLoader.prototype = {
    constructor: MediaPlayer.dependencies.ManifestLoader
};


;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.models.ManifestModel = function () {
    "use strict";

    var manifest;

    return {
        system: undefined,
        eventBus: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_MANIFEST_UPDATED: "manifestUpdated"
        },

        getValue:  function () {
            return manifest;
        },

        setValue: function (value) {
            manifest = value;

            this.eventBus.dispatchEvent({
                type: "manifestLoaded",
                data: value
            });

            this.notify(this.eventList.ENAME_MANIFEST_UPDATED, value);
        }
    };
};

MediaPlayer.models.ManifestModel.prototype = {
    constructor: MediaPlayer.models.ManifestModel
};




;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.ManifestUpdater = function () {
    "use strict";

    var refreshDelay = NaN,
        refreshTimer = null,
        isStopped = false,
        isUpdating = false,

        clear = function () {
            if (refreshTimer !== null) {
                clearInterval(refreshTimer);
                refreshTimer = null;
            }
        },

        start = function () {
            clear.call(this);

            if (!isNaN(refreshDelay)) {
                this.debug.log("Refresh manifest in " + refreshDelay + " seconds.");
                refreshTimer = setTimeout(onRefreshTimer.bind(this), Math.min(refreshDelay * 1000, Math.pow(2, 31) - 1), this);
            }
        },

        update = function () {
            var self = this,
                manifest = self.manifestModel.getValue(),
                delay,
                timeSinceLastUpdate;

            if (manifest !== undefined && manifest !== null) {
                delay = self.manifestExt.getRefreshDelay(manifest);
                timeSinceLastUpdate = (new Date().getTime() - manifest.loadedTime.getTime()) / 1000;
                refreshDelay = Math.max(delay - timeSinceLastUpdate, 0);
                start.call(self);
            }
        },

        onRefreshTimer = function () {
            var self = this,
                manifest,
                url;

            if (isUpdating) return;

            isUpdating = true;
            manifest = self.manifestModel.getValue();
            url = manifest.url;

            if (manifest.hasOwnProperty("Location")) {
                url = manifest.Location;
            }

            //self.debug.log("Refresh manifest @ " + url);

            self.manifestLoader.load(url);
        },

        onManifestLoaded = function(sender, manifest, error) {
            if (error) return;

            this.manifestModel.setValue(manifest);
            this.debug.log("Manifest has been refreshed.");
            //self.debug.log(manifestResult);
            if (isStopped) return;

            update.call(this);
        },

        onPlaybackStarted = function() {
            this.start();
        },

        onPlaybackPaused = function() {
            this.stop();
        },

        onStreamsComposed = function() {
            // When streams are ready we can consider manifest update completed. Resolve the update promise.
            isUpdating = false;
        };

    return {
        debug: undefined,
        system: undefined,
        manifestModel: undefined,
        manifestExt: undefined,
        manifestLoader: undefined,

        setup: function () {
            update.call(this);
            // Listen to streamsComposed event to be aware that the streams have been composed
            this.streamsComposed = onStreamsComposed;
            this.manifestLoaded = onManifestLoaded;
            this.playbackStarted = onPlaybackStarted;
            this.playbackPaused = onPlaybackPaused;
        },

        start: function () {
            isStopped = false;
            update.call(this);
        },

        stop: function() {
            isStopped = true;
            clear.call(this);
        }
    };
};

MediaPlayer.dependencies.ManifestUpdater.prototype = {
    constructor: MediaPlayer.dependencies.ManifestUpdater
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.MediaSourceExtensions = function () {
    "use strict";
};

MediaPlayer.dependencies.MediaSourceExtensions.prototype = {
    constructor: MediaPlayer.dependencies.MediaSourceExtensions,

    createMediaSource: function () {
        "use strict";

        var hasWebKit = ("WebKitMediaSource" in window),
            hasMediaSource = ("MediaSource" in window);

        if (hasMediaSource) {
            return new MediaSource();
        } else if (hasWebKit) {
            return new WebKitMediaSource();
        }

        return null;
    },

    attachMediaSource: function (source, videoModel) {
        "use strict";

        videoModel.setSource(window.URL.createObjectURL(source));
    },

    detachMediaSource: function (videoModel) {
        "use strict";
        // it seems that any value passed to the setSource is cast to a sting when setting element.src,
        // so we cannot use null or undefined to reset the element. Use empty string instead.
        videoModel.setSource("");
    },

    setDuration: function (source, value) {
        "use strict";

        source.duration = value;

        return source.duration;
    },

    signalEndOfStream: function(source) {
        "use strict";

        var buffers = source.sourceBuffers,
            ln = buffers.length,
            i = 0;

        if (source.readyState !== "open") return;

        for (i; i < ln; i += 1) {
            if (buffers[i].updating) return;
        }

        source.endOfStream();
    }
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.models.MetricsModel = function () {
    "use strict";

    return {
        system : undefined,
        eventBus: undefined,
        adapter: undefined,
        streamMetrics: {},
        metricsChanged: function () {
            this.eventBus.dispatchEvent({
                type: "metricsChanged",
                data: {}
            });
        },

        metricChanged: function (mediaType) {
            this.eventBus.dispatchEvent({
                type: "metricChanged",
                data: {stream: mediaType}
            });
            this.metricsChanged();
        },

        metricUpdated: function (mediaType, metricType, vo) {
            this.eventBus.dispatchEvent({
                type: "metricUpdated",
                data: {stream: mediaType, metric: metricType, value: vo}
            });
            this.metricChanged(mediaType);
        },

        metricAdded: function (mediaType, metricType, vo) {
            this.eventBus.dispatchEvent({
                type: "metricAdded",
                data: {stream: mediaType, metric: metricType, value: vo}
            });
            this.metricChanged(mediaType);
        },

        clearCurrentMetricsForType: function (type) {
            delete this.streamMetrics[type];
            this.metricChanged(type);
        },

        clearAllCurrentMetrics: function () {
            var self = this;
            this.streamMetrics = {};
            this.metricsChanged.call(self);
        },

        getReadOnlyMetricsFor: function(type) {
            if (this.streamMetrics.hasOwnProperty(type)) {
                return this.streamMetrics[type];
            }

            return null;
        },

        getMetricsFor: function(type) {
            var metrics;

            if (this.streamMetrics.hasOwnProperty(type)) {
                metrics = this.streamMetrics[type];
            } else {
                metrics = this.system.getObject("metrics");
                this.streamMetrics[type] = metrics;
            }

            return metrics;
        },

        addTcpConnection: function (mediaType, tcpid, dest, topen, tclose, tconnect) {
            var vo = new MediaPlayer.vo.metrics.TCPConnection();

            vo.tcpid = tcpid;
            vo.dest = dest;
            vo.topen = topen;
            vo.tclose = tclose;
            vo.tconnect = tconnect;

            this.getMetricsFor(mediaType).TcpList.push(vo);

            this.metricAdded(mediaType, this.adapter.metricsList.TCP_CONNECTION, vo);
            return vo;
        },

        addHttpRequest: function (mediaType, tcpid, type, url, actualurl, range, trequest, tresponse, tfinish, responsecode, interval, mediaduration) {
            var vo = new MediaPlayer.vo.metrics.HTTPRequest();

            vo.stream = mediaType;
            vo.tcpid = tcpid;
            vo.type = type;
            vo.url = url;
            vo.actualurl = actualurl;
            vo.range = range;
            vo.trequest = trequest;
            vo.tresponse = tresponse;
            vo.tfinish = tfinish;
            vo.responsecode = responsecode;
            vo.interval = interval;
            vo.mediaduration = mediaduration;

            this.getMetricsFor(mediaType).HttpList.push(vo);

            this.metricAdded(mediaType, this.adapter.metricsList.HTTP_REQUEST, vo);
            return vo;
        },

        appendHttpTrace: function (httpRequest, s, d, b) {
            var vo = new MediaPlayer.vo.metrics.HTTPRequest.Trace();

            vo.s = s;
            vo.d = d;
            vo.b = b;

            httpRequest.trace.push(vo);

            this.metricUpdated(httpRequest.stream, this.adapter.metricsList.HTTP_REQUEST_TRACE, httpRequest);
            return vo;
        },

        addTrackSwitch: function (mediaType, t, mt, to, lto) {
            var vo = new MediaPlayer.vo.metrics.TrackSwitch();

            vo.t = t;
            vo.mt = mt;
            vo.to = to;
            vo.lto = lto;

            this.getMetricsFor(mediaType).RepSwitchList.push(vo);

            this.metricAdded(mediaType, this.adapter.metricsList.TRACK_SWITCH, vo);
            return vo;
        },

        addBufferLevel: function (mediaType, t, level) {
            var vo = new MediaPlayer.vo.metrics.BufferLevel();

            vo.t = t;
            vo.level = level;

            this.getMetricsFor(mediaType).BufferLevel.push(vo);

            this.metricAdded(mediaType, this.adapter.metricsList.BUFFER_LEVEL, vo);
            return vo;
        },


        addDVRInfo: function (mediaType, currentTime, mpd, range)
        {
            var vo = new MediaPlayer.vo.metrics.DVRInfo();

            vo.time = currentTime ;
            vo.range = range;
            vo.manifestInfo = mpd;

            this.getMetricsFor(mediaType).DVRInfo.push(vo);
            this.metricAdded(mediaType, this.adapter.metricsList.DVR_INFO, vo);

            return vo;
        },

        addDroppedFrames: function (mediaType, quality) {
            var vo = new MediaPlayer.vo.metrics.DroppedFrames(),
                list = this.getMetricsFor(mediaType).DroppedFrames;

            vo.time = quality.creationTime;
            vo.droppedFrames = quality.droppedVideoFrames;

            if (list.length > 0 && list[list.length - 1] == vo) {
                return list[list.length - 1];
            }

            list.push(vo);

            this.metricAdded(mediaType, this.adapter.metricsList.DROPPED_FRAMES, vo);
            return vo;
        },

        addSchedulingInfo: function(mediaType, t, type, startTime, availabilityStartTime, duration, quality, range, state) {
            var vo = new MediaPlayer.vo.metrics.SchedulingInfo();

            vo.mediaType = mediaType;
            vo.t = t;

            vo.type = type;
            vo.startTime = startTime;
            vo.availabilityStartTime = availabilityStartTime;
            vo.duration = duration;
            vo.quality = quality;
            vo.range = range;

            vo.state = state;

            this.getMetricsFor(mediaType).SchedulingInfo.push(vo);

            this.metricAdded(mediaType, this.adapter.metricsList.SCHEDULING_INFO, vo);
            return vo;
        },

        addManifestUpdate: function(mediaType, type, requestTime, fetchTime, availabilityStartTime, presentationStartTime, clientTimeOffset, currentTime, buffered, latency) {
            var vo = new MediaPlayer.vo.metrics.ManifestUpdate(),
                metrics = this.getMetricsFor("stream");

            vo.mediaType = mediaType;
            vo.type = type;
            vo.requestTime = requestTime; // when this manifest update was requested
            vo.fetchTime = fetchTime; // when this manifest update was received
            vo.availabilityStartTime = availabilityStartTime;
            vo.presentationStartTime = presentationStartTime; // the seek point (liveEdge for dynamic, Stream[0].startTime for static)
            vo.clientTimeOffset = clientTimeOffset; // the calculated difference between the server and client wall clock time
            vo.currentTime = currentTime; // actual element.currentTime
            vo.buffered = buffered; // actual element.ranges
            vo.latency = latency; // (static is fixed value of zero. dynamic should be ((Now-@availabilityStartTime) - currentTime)

            metrics.ManifestUpdate.push(vo);
            this.metricAdded(mediaType, this.adapter.metricsList.MANIFEST_UPDATE, vo);

            return vo;
        },

        updateManifestUpdateInfo: function(manifestUpdate, updatedFields) {
            for (var field in updatedFields) {
                manifestUpdate[field] = updatedFields[field];
            }

            this.metricUpdated(manifestUpdate.mediaType, this.adapter.metricsList.MANIFEST_UPDATE, manifestUpdate);
        },

        addManifestUpdateStreamInfo: function(manifestUpdate, id, index, start, duration) {
            var vo = new MediaPlayer.vo.metrics.ManifestUpdate.StreamInfo();

            vo.id = id;
            vo.index = index;
            vo.start = start;
            vo.duration = duration;

            manifestUpdate.streamInfo.push(vo);
            this.metricUpdated(manifestUpdate.mediaType, this.adapter.metricsList.MANIFEST_UPDATE_STREAM_INFO, manifestUpdate);

            return vo;
        },

        addManifestUpdateTrackInfo: function(manifestUpdate, id, index, streamIndex, mediaType, presentationTimeOffset, startNumber, fragmentInfoType) {
            var vo = new MediaPlayer.vo.metrics.ManifestUpdate.TrackInfo();

            vo.id = id;
            vo.index = index;
            vo.streamIndex = streamIndex;
            vo.mediaType = mediaType;
            vo.startNumber = startNumber;
            vo.fragmentInfoType = fragmentInfoType;
            vo.presentationTimeOffset = presentationTimeOffset;

            manifestUpdate.trackInfo.push(vo);
            this.metricUpdated(manifestUpdate.mediaType, this.adapter.metricsList.MANIFEST_UPDATE_TRACK_INFO, manifestUpdate);

            return vo;
        },

        addPlayList: function (mediaType, start, mstart, starttype) {
            var vo = new MediaPlayer.vo.metrics.PlayList();

            vo.stream = mediaType;
            vo.start = start;
            vo.mstart = mstart;
            vo.starttype = starttype;

            this.getMetricsFor(mediaType).PlayList.push(vo);

            this.metricAdded(mediaType, this.adapter.metricsList.PLAY_LIST, vo);
            return vo;
        },

        appendPlayListTrace: function (playList, trackId, subreplevel, start, mstart, duration, playbackspeed, stopreason) {
            var vo = new MediaPlayer.vo.metrics.PlayList.Trace();

            vo.representationid = trackId;
            vo.subreplevel = subreplevel;
            vo.start = start;
            vo.mstart = mstart;
            vo.duration = duration;
            vo.playbackspeed = playbackspeed;
            vo.stopreason = stopreason;

            playList.trace.push(vo);

            this.metricUpdated(playList.stream, this.adapter.metricsList.PLAY_LIST_TRACE, playList);
            return vo;
        }
    };
};

MediaPlayer.models.MetricsModel.prototype = {
    constructor: MediaPlayer.models.MetricsModel
};;MediaPlayer.dependencies.Notifier = function () {
    "use strict";

    var system,
        id = 0,

        getId = function() {
            if (!this.id) {
                id += 1;
                this.id = "_id_" + id;
            }

            return this.id;
        },

        isEventSupported = function(eventName) {
            var event,
                events = this.eventList;

            for (event in events) {
                if (events[event] === eventName) return true;
            }

            return false;
        };

    return {
        system : undefined,

        setup: function() {
            system = this.system;
            system.mapValue('notify', this.notify);
            system.mapValue('subscribe', this.subscribe);
            system.mapValue('unsubscribe', this.unsubscribe);
        },

        notify: function (/*eventName[, args]*/) {
            var args = [].slice.call(arguments);
            args.splice(1, 0, this);

            args[0] += getId.call(this);

            system.notify.apply(system, args);
        },

        subscribe: function(eventName, observer, handler, oneShot) {
            if (!handler && observer[eventName]) {
                handler = observer[eventName] = observer[eventName].bind(observer);
            }

            if(!isEventSupported.call(this, eventName)) throw ("object does not support given event " + eventName);

            if(!observer) throw "observer object cannot be null or undefined";

            if(!handler) throw "event handler cannot be null or undefined";

            eventName += getId.call(this);

            system.mapHandler(eventName, undefined, handler, oneShot);
        },

        unsubscribe: function(eventName, observer, handler) {
            handler = handler || observer[eventName];
            eventName += getId.call(this);

            system.unmapHandler(eventName, undefined, handler);
        }
    };
};

MediaPlayer.dependencies.Notifier.prototype = {
    constructor: MediaPlayer.dependencies.Notifier
};;MediaPlayer.dependencies.PlaybackController = function () {
    "use strict";

    var WALLCLOCK_TIME_UPDATE_INTERVAL = 1000,
        currentTime = 0,
        liveStartTime = NaN,
        wallclockTimeIntervalId,
        commonEarliestTime = null,
        streamInfo,
        videoModel,
        trackInfo,
        isDynamic,

        getStreamStartTime = function (streamInfo) {
            var presentationStartTime,
                startTimeOffset = parseInt(this.uriQueryFragModel.getURIFragmentData.s);

            if (isDynamic) {

                if (!isNaN(startTimeOffset) && startTimeOffset > 1262304000) {

                    presentationStartTime = startTimeOffset - (streamInfo.manifestInfo.availableFrom.getTime()/1000);

                    if (presentationStartTime > liveStartTime ||
                        presentationStartTime < (liveStartTime - streamInfo.manifestInfo.DVRWindowSize)) {

                        presentationStartTime = null;
                    }
                }
                presentationStartTime = presentationStartTime || liveStartTime;

            } else {
                if (!isNaN(startTimeOffset) && startTimeOffset < streamInfo.duration && startTimeOffset >= 0) {
                    presentationStartTime = startTimeOffset;
                }else{
                    presentationStartTime = streamInfo.start;
                }
            }

            return presentationStartTime;
        },

        getActualPresentationTime = function() {
            var self = this,
                currentTime = self.getTime(),
                metrics = self.metricsModel.getMetricsFor(trackInfo.mediaInfo.type),
                DVRMetrics = self.metricsExt.getCurrentDVRInfo(metrics),
                DVRWindow = DVRMetrics ? DVRMetrics.range : null,
                actualTime;

            if (!DVRWindow) return NaN;

            if ((currentTime >= DVRWindow.start) && (currentTime <= DVRWindow.end)) {
                return currentTime;
            }

            actualTime = Math.max(DVRWindow.end - streamInfo.manifestInfo.minBufferTime * 2, DVRWindow.start);

            return actualTime;
        },

        startUpdatingWallclockTime = function() {
            var self = this,
                tick = function() {
                    onWallclockTime.call(self);
                };

            if (wallclockTimeIntervalId !== null) {
                stopUpdatingWallclockTime.call(this);
            }

            wallclockTimeIntervalId = setInterval(tick, WALLCLOCK_TIME_UPDATE_INTERVAL);
        },

        stopUpdatingWallclockTime = function() {
            clearInterval(wallclockTimeIntervalId);
            wallclockTimeIntervalId = null;
        },

        initialStart = function() {
            var initialSeekTime = getStreamStartTime.call(this, streamInfo);
            this.debug.log("Starting playback at offset: " + initialSeekTime);
            this.seek(initialSeekTime);
        },

        updateCurrentTime = function() {
            if (this.isPaused() || !isDynamic) return;

            var currentTime = this.getTime(),
                actualTime = getActualPresentationTime.call(this),
                timeChanged = (!isNaN(actualTime) && actualTime !== currentTime);

            if (timeChanged) {
                this.seek(actualTime);
            }
        },

        onDataUpdateCompleted = function(sender, mediaData, TrackData) {
            trackInfo = this.adapter.convertDataToTrack(TrackData);
            streamInfo = trackInfo.mediaInfo.streamInfo;
            isDynamic = sender.streamProcessor.isDynamic();
            updateCurrentTime.call(this);
        },

        onLiveEdgeFound = function(/*sender, liveEdgeTime, searchTime*/) {
            if (videoModel.getElement().readyState !== 0) {
                initialStart.call(this);
            }
        },

        removeAllListeners = function() {
            if (!videoModel) return;

            videoModel.unlisten("play", onPlaybackStart);
            videoModel.unlisten("pause", onPlaybackPaused);
            videoModel.unlisten("error", onPlaybackError);
            videoModel.unlisten("seeking", onPlaybackSeeking);
            videoModel.unlisten("seeked", onPlaybackSeeked);
            videoModel.unlisten("timeupdate", onPlaybackTimeUpdated);
            videoModel.unlisten("progress", onPlaybackProgress);
            videoModel.unlisten("ratechange", onPlaybackRateChanged);
            videoModel.unlisten("loadedmetadata", onPlaybackMetaDataLoaded);
        },

        onPlaybackStart = function() {
            //this.debug.log("Got play event.");
            updateCurrentTime.call(this);
            this.notify(this.eventList.ENAME_PLAYBACK_STARTED, this.getTime());
        },

        onPlaybackPaused = function() {
            //this.debug.log("Got pause event.");
            this.notify(this.eventList.ENAME_PLAYBACK_PAUSED);
        },

        onPlaybackSeeking = function() {
            //this.debug.log("Got seeking event.");
            this.notify(this.eventList.ENAME_PLAYBACK_SEEKING, this.getTime(), false);
        },

        onPlaybackSeeked = function() {
            //this.debug.log("Seek complete.");
            this.notify(this.eventList.ENAME_PLAYBACK_SEEKED);
        },

        onPlaybackTimeUpdated = function() {
            var time = this.getTime();

            if (time === currentTime) return;

            currentTime = time;
            this.notify(this.eventList.ENAME_PLAYBACK_TIME_UPDATED, this.getTimeToStreamEnd());
        },

        onPlaybackProgress = function() {
            var ranges = videoModel.getElement().buffered,
                lastRange,
                bufferEndTime,
                remainingUnbufferedDuration;

            if (ranges.length) {
                lastRange = ranges.length -1;
                bufferEndTime = ranges.end(lastRange);
                remainingUnbufferedDuration = getStreamStartTime.call(this, streamInfo) + streamInfo.duration - bufferEndTime;
            }

            this.notify(this.eventList.ENAME_PLAYBACK_PROGRESS, videoModel.getElement().buffered, remainingUnbufferedDuration);
        },

        onPlaybackRateChanged = function() {
            this.notify(this.eventList.ENAME_PLAYBACK_RATE_CHANGED);
        },

        onPlaybackMetaDataLoaded = function() {
            this.debug.log("Got loadmetadata event.");

            if (!isDynamic || this.timelineConverter.isTimeSyncCompleted()) {
                initialStart.call(this);
            }

            this.notify(this.eventList.ENAME_PLAYBACK_METADATA_LOADED);
            startUpdatingWallclockTime.call(this);
        },

        onPlaybackError = function(event) {
            this.notify(this.eventList.ENAME_PLAYBACK_ERROR, event.srcElement.error);
        },

        onWallclockTime = function() {
            this.notify(this.eventList.ENAME_WALLCLOCK_TIME_UPDATED,isDynamic, new Date());
        },

        onBytesAppended = function(sender, quality, index, ranges) {
            var bufferedStart,
                currentEarliestTime = commonEarliestTime,
                playbackStart = getStreamStartTime.call(this, streamInfo),
                req;

            if (!ranges || !ranges.length) return;

            // since segments are appended out of order, we cannot blindly seek after the first appended segment.
            // Do nothing till we make sure that the segment for initial time has been appended.
            req = this.adapter.getFragmentRequestForTime(sender.streamProcessor, trackInfo, playbackStart, false);

            if (!req || req.index !== index) return;

            bufferedStart = ranges.start(0);
            commonEarliestTime = (commonEarliestTime === null) ? bufferedStart : Math.max(commonEarliestTime, bufferedStart);

            if (currentEarliestTime === commonEarliestTime) return;

            // seek to the start of buffered range to avoid stalling caused by a shift between audio and video media time
            this.seek(commonEarliestTime);
        },

        setupVideoModel = function(model) {
            videoModel = model;

            videoModel.listen("play", onPlaybackStart);
            videoModel.listen("pause", onPlaybackPaused);
            videoModel.listen("error", onPlaybackError);
            videoModel.listen("seeking", onPlaybackSeeking);
            videoModel.listen("seeked", onPlaybackSeeked);
            videoModel.listen("timeupdate", onPlaybackTimeUpdated);
            videoModel.listen("progress", onPlaybackProgress);
            videoModel.listen("ratechange", onPlaybackRateChanged);
            videoModel.listen("loadedmetadata", onPlaybackMetaDataLoaded);
        };

    return {
        debug: undefined,
        timelineConverter: undefined,
        uriQueryFragModel: undefined,
        metricsModel: undefined,
        metricsExt: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        adapter: undefined,

        eventList: {
            ENAME_PLAYBACK_STARTED: "playbackStarted",
            ENAME_PLAYBACK_STOPPED: "playbackStopped",
            ENAME_PLAYBACK_PAUSED: "playbackPaused",
            ENAME_PLAYBACK_SEEKING: "playbackSeeking",
            ENAME_PLAYBACK_SEEKED: "playbackSeeked",
            ENAME_PLAYBACK_TIME_UPDATED: "playbackTimeUpdated",
            ENAME_PLAYBACK_PROGRESS: "playbackProgress",
            ENAME_PLAYBACK_RATE_CHANGED: "playbackRateChanged",
            ENAME_PLAYBACK_METADATA_LOADED: "playbackMetaDataLoaded",
            ENAME_PLAYBACK_ERROR: "playbackError",
            ENAME_WALLCLOCK_TIME_UPDATED: "wallclockTimeUpdated"
        },

        setup: function() {
            this.dataUpdateCompleted = onDataUpdateCompleted;
            this.liveEdgeFound = onLiveEdgeFound;
            this.bytesAppended = onBytesAppended;

            onPlaybackStart = onPlaybackStart.bind(this);
            onPlaybackPaused = onPlaybackPaused.bind(this);
            onPlaybackError = onPlaybackError.bind(this);
            onPlaybackSeeking = onPlaybackSeeking.bind(this);
            onPlaybackSeeked = onPlaybackSeeked.bind(this);
            onPlaybackTimeUpdated = onPlaybackTimeUpdated.bind(this);
            onPlaybackProgress = onPlaybackProgress.bind(this);
            onPlaybackRateChanged = onPlaybackRateChanged.bind(this);
            onPlaybackMetaDataLoaded = onPlaybackMetaDataLoaded.bind(this);
        },

        initialize: function(streamInfoValue, model) {
            streamInfo = streamInfoValue;

            if (videoModel === model) return;

            removeAllListeners.call(this);
            setupVideoModel.call(this, model);
        },

        getTimeToStreamEnd: function() {
            var currentTime = videoModel.getCurrentTime();

            return ((getStreamStartTime.call(this, streamInfo) + streamInfo.duration) - currentTime);
        },

        getStreamId: function() {
            return streamInfo.id;
        },

        getStreamDuration: function() {
            return streamInfo.duration;
        },

        getTime: function() {
            return videoModel.getCurrentTime();
        },

        getPlaybackRate: function() {
            return videoModel.getPlaybackRate();
        },

        setLiveStartTime: function(value) {
            liveStartTime = value;
        },

        getLiveStartTime: function() {
            return liveStartTime;
        },

        start: function() {
            videoModel.play();
        },

        isPaused: function() {
            return videoModel.isPaused();
        },

        pause: function() {
            if (videoModel) {
                videoModel.pause();
            }
        },

        isSeeking: function(){
            return videoModel.getElement().seeking;
        },

        seek: function(time) {
            if (time === this.getTime()) return;
            videoModel.setCurrentTime(time);
            this.notify(this.eventList.ENAME_PLAYBACK_SEEKING, time, true);
        },

        reset: function() {
            stopUpdatingWallclockTime.call(this);
            removeAllListeners.call(this);
            videoModel = null;
            streamInfo = null;
            currentTime = 0;
            liveStartTime = NaN;
            commonEarliestTime = null;
        }
    };
};

MediaPlayer.dependencies.PlaybackController.prototype = {
    constructor: MediaPlayer.dependencies.PlaybackController
};;// The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
//
// Copyright (c) 2013, Microsoft Open Technologies, Inc.
//
// All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//     -             Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//     -             Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//     -             Neither the name of the Microsoft Open Technologies, Inc. nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

MediaPlayer.dependencies.ProtectionController = function () {
    "use strict";

    var element = null,
        keySystems = null,

        teardownKeySystem = function (kid) {
            var self = this;
            self.protectionModel.removeKeySystem(kid);
        },

        selectKeySystem = function (mediaInfo) {
            var self = this,
                codec = mediaInfo.codec,
                contentProtection = mediaInfo.contentProtection;

            for(var ks = 0; ks < keySystems.length; ++ks) {
                for(var cp = 0; cp < contentProtection.length; ++cp) {
                    if (keySystems[ks].isSupported(contentProtection[cp]) &&
                        self.protectionExt.supportsCodec(keySystems[ks].keysTypeString, codec)) {

                        var kid = contentProtection[cp].KID;
                        if (!kid) {
                            kid = "unknown";
                        }

                        self.protectionModel.addKeySystem(kid, contentProtection[cp], keySystems[ks]);

                        self.debug.log("DRM: Selected Key System: " + keySystems[ks].keysTypeString + " For KID: " + kid);

                        return kid;
                    }
                }
            }
            throw new Error("DRM: The protection system for this content is not supported.");
        },

        ensureKeySession = function (kid, codec, event) {
            var self = this,
                session = null,
                eventInitData = event.initData,
                initData = null;

            if (!self.protectionModel.needToAddKeySession(kid, event)) {
                return;
            }

            initData = self.protectionModel.getInitData(kid);

            if (!initData && !!eventInitData) {
                initData = eventInitData;
                self.debug.log("DRM: Using initdata from needskey event. length: " + initData.length);
            }
            else if (!!initData){
                self.debug.log("DRM: Using initdata from prheader in mpd. length: " + initData.length);
            }

            if (!!initData) {
                session = self.protectionModel.addKeySession(kid, codec, initData);
                if (session) {
                    self.debug.log("DRM: Added Key Session [" + session.sessionId + "] for KID: " + kid + " type: " + codec + " initData length: " + initData.length);
                } else {
                    self.debug.log("DRM: Added Key Session for KID: " + kid + " type: " + codec + " initData length: " + initData.length);
                }
            }
            else {
                self.debug.log("DRM: initdata is null.");
            }
        },

        updateFromMessage = function (kid, session, event) {
            this.protectionModel.updateFromMessage(kid, session, event);
        };

    return {
        system : undefined,
        debug : undefined,
        capabilities : undefined,
        protectionModel : undefined,
        protectionExt : undefined,

        setup : function () {
        },

        init: function (videoModel, protectionModel, protectionData) {
            keySystems = this.protectionExt.getKeySystems(protectionData);
            this.videoModel = videoModel;
            this.protectionModel = protectionModel;
            element = this.videoModel.getElement();
        },

        getBearerToken: function(keySystem) {
            var i = 0,
                ln = keySystems.length,
                ks;

            for (i; i < ln; i += 1) {
                ks = keySystems[i];
                if (ks.keysTypeString === keySystem) return ks.bearerToken;
            }

            return null;
        },

        setBearerToken: function(tokenObj) {
            var i = 0,
                ln = keySystems.length,
                ks;

            for (i; i < ln; i += 1) {
                ks = keySystems[i];
                if (ks.keysTypeString === tokenObj.keySystem){
                    ks.bearerToken = tokenObj.token;
                }
            }
        },

        selectKeySystem : selectKeySystem,
        ensureKeySession : ensureKeySession,
        updateFromMessage : updateFromMessage,
        teardownKeySystem : teardownKeySystem
    };
};

MediaPlayer.dependencies.ProtectionController.prototype = {
    constructor: MediaPlayer.dependencies.ProtectionController
};
;// The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
//
// Copyright (c) 2013, Microsoft Open Technologies, Inc. 
//
// All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//     -             Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//     -             Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//     -             Neither the name of the Microsoft Open Technologies, Inc. nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

MediaPlayer.dependencies.ProtectionExtensions = function () {
    "use strict";
};

MediaPlayer.dependencies.ProtectionExtensions.prototype = {
    constructor: MediaPlayer.dependencies.ProtectionExtensions,
    notify: undefined,
    subscribe: undefined,
    unsubscribe: undefined,
    eventList: {
        ENAME_KEY_SYSTEM_UPDATE_COMPLETED: "keySystemUpdateCompleted"
    },

    supportsCodec: function (mediaKeysString, codec) {
        "use strict";

        var hasWebKit = ("WebKitMediaKeys" in window),
            hasMs = ("MSMediaKeys" in window),
            hasMediaSource = ("MediaKeys" in window),
            hasWebkitGenerateKeyRequest = ('webkitGenerateKeyRequest' in document.createElement('video'));

        if (hasMediaSource) {
            return MediaKeys.isTypeSupported(mediaKeysString, codec);
        } else if (hasWebKit) {
            return WebKitMediaKeys.isTypeSupported(mediaKeysString, codec);
        } else if (hasMs) {
            return MSMediaKeys.isTypeSupported(mediaKeysString, codec);
        } else if (hasWebkitGenerateKeyRequest) {
            // Chrome doesn't currently support a way to check for isTypeSupported, so we are assuming it is
            return true;
        }

        return false;
    },

    createMediaKeys: function (mediaKeysString) {
        "use strict";

        var hasWebKit = ("WebKitMediaKeys" in window),
            hasMs = ("MSMediaKeys" in window),
            hasMediaSource = ("MediaKeys" in window);

        if (hasMediaSource) {
            return new MediaKeys(mediaKeysString);
        } else if (hasWebKit) {
            return new WebKitMediaKeys(mediaKeysString);
        } else if (hasMs) {
            return new MSMediaKeys(mediaKeysString);
        }

        return null;
    },

    setMediaKey: function (element, mediaKeys) {
        var hasWebKit = ("WebKitSetMediaKeys" in element),
            hasMs = ("msSetMediaKeys" in element),
            hasStd = ("SetMediaKeys" in element),
            hasWebkitGenerateKeyRequest = ('webkitGenerateKeyRequest' in document.createElement('video'));

        if (hasStd) {
            return element.SetMediaKeys(mediaKeys);
        } else if (hasWebKit) {
            return element.WebKitSetMediaKeys(mediaKeys);
        } else if (hasMs) {
            return element.msSetMediaKeys(mediaKeys);
        } else if (hasWebkitGenerateKeyRequest) {
            // Not yet supported by Chrome, and not necessary for the current Widevine implementation
            return true;
        } else {
            this.debug.log("no setmediakeys function in element");
        }
    },

    createSession: function (mediaKeys, mediaCodec, initData, cdmData) {
        if (null !== cdmData) {
            return mediaKeys.createSession(mediaCodec, initData, cdmData);
        }
        return mediaKeys.createSession(mediaCodec, initData);
    },

    getKeySystems: function (protectionData) {
        var self = this,
            _protectionData = protectionData,
            getLAUrl = function (laUrl, keysystem) {
                if (protectionData[keysystem] != undefined) {
                    if (protectionData[keysystem].laUrl != null && protectionData[keysystem].laUrl != '') {
                        return protectionData[keysystem].laUrl;
                    }
                }
                return laUrl;
            }
            playreadyGetUpdate = function (event) {
                var decodedChallenge = null,
                    headers = [],
                    parser = new DOMParser(),
                    xmlDoc,
                    msg,
                    laURL;

                bytes = new Uint16Array(event.message.buffer);
                msg = String.fromCharCode.apply(null, bytes);
                xmlDoc = parser.parseFromString(msg, "application/xml");
                laURL = event.destinationURL;

                if (xmlDoc.getElementsByTagName("Challenge")[0]) {
                    var Challenge = xmlDoc.getElementsByTagName("Challenge")[0].childNodes[0].nodeValue;
                    if (Challenge) {
                        decodedChallenge = BASE64.decode(Challenge);
                    }
                }
                else {
                    self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, null, new Error('DRM: playready update, can not find Challenge in keyMessage'));
                }

                var headerNameList = xmlDoc.getElementsByTagName("name");
                var headerValueList = xmlDoc.getElementsByTagName("value");

                if (headerNameList.length != headerValueList.length) {
                    self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, null, new Error('DRM: playready update, invalid header name/value pair in keyMessage'));
                }

                for (var i = 0; i < headerNameList.length; i++) {
                    headers[i] = {
                        name: headerNameList[i].childNodes[0].nodeValue,
                        value: headerValueList[i].childNodes[0].nodeValue
                    };
                }

                if (this.bearerToken) {
                    headers.push({name: "Authorization", value: this.bearerToken});
                }

                var xhr = new XMLHttpRequest();
                xhr.onload = function () {
                    if (xhr.status == 200) {
                        self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, new Uint8Array(xhr.response));
                    } else {
                        self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, null, new Error('DRM: playready update, XHR status is "' + xhr.statusText + '" (' + xhr.status + '), expected to be 200. readyState is ' + xhr.readyState));
                    }
                };
                xhr.onabort = function () {
                    self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, null, new Error('DRM: playready update, XHR aborted. status is "' + xhr.statusText + '" (' + xhr.status + '), readyState is ' + xhr.readyState));
                };
                xhr.onerror = function () {
                    self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, null, new Error('DRM: playready update, XHR error. status is "' + xhr.statusText + '" (' + xhr.status + '), readyState is ' + xhr.readyState));
                };

                xhr.open('POST', getLAUrl(laURL, "com.microsoft.playready"));
                xhr.responseType = 'arraybuffer';
                var key, headerOverrides = (_protectionData["com.microsoft.playready"]) ? _protectionData["com.microsoft.playready"].headers : null;
                if (headerOverrides) {
                    for (key in headerOverrides) {
                        headers.push({name: key, value: headerOverrides[key]});
                    }
                }
                if (headers) {
                    headers.forEach(function(hdr) {
                        if ('authorization' === hdr.name.toLowerCase()) {
                            xhr.withCredentials = true;
                        }

                        xhr.setRequestHeader(hdr.name, hdr.value);
                    });
                }
                xhr.send(decodedChallenge);
            },
            playReadyNeedToAddKeySession = function (initData, keySessions, event) {
                return initData === null && keySessions.length === 0;
            },
            playreadyGetInitData = function (data) {
                    // * desc@ getInitData
                    // *   generate PSSH data from PROHeader defined in MPD file
                    // *   PSSH format:
                    // *   size (4)
                    // *   box type(PSSH) (8)
                    // *   Protection SystemID (16)
                    // *   protection system data size (4) - length of decoded PROHeader
                    // *   decoded PROHeader data from MPD file  
                    var byteCursor = 0,
                        PROSize = 0,
                        PSSHSize = 0,
                        PSSHBoxType =  new Uint8Array([0x70, 0x73, 0x73, 0x68, 0x00, 0x00, 0x00, 0x00 ]), //'PSSH' 8 bytes
                        playreadySystemID = new Uint8Array([0x9a, 0x04, 0xf0, 0x79, 0x98, 0x40, 0x42, 0x86, 0xab, 0x92, 0xe6, 0x5b, 0xe0, 0x88, 0x5f, 0x95]),
                        uint8arraydecodedPROHeader = null,
                        PSSHBoxBuffer = null,
                        PSSHBox = null,
                        PSSHData = null;

                    if ("pro" in data) {
                        uint8arraydecodedPROHeader = BASE64.decodeArray(data.pro.__text);
                    }
                    else if ("prheader" in data) {
                        uint8arraydecodedPROHeader = BASE64.decodeArray(data.prheader.__text);
                    }
                    else {
                        return null;
                    }

                    PROSize = uint8arraydecodedPROHeader.length;
                    PSSHSize = 0x4 + PSSHBoxType.length + playreadySystemID.length + 0x4 + PROSize;

                    PSSHBoxBuffer = new ArrayBuffer(PSSHSize);

                    PSSHBox = new Uint8Array(PSSHBoxBuffer);
                    PSSHData = new DataView(PSSHBoxBuffer);

                    PSSHData.setUint32(byteCursor, PSSHSize);
                    byteCursor += 0x4;

                    PSSHBox.set(PSSHBoxType, byteCursor);
                    byteCursor += PSSHBoxType.length;

                    PSSHBox.set(playreadySystemID, byteCursor);
                    byteCursor += playreadySystemID.length;

                    PSSHData.setUint32(byteCursor, PROSize);
                    byteCursor += 0x4;

                    PSSHBox.set(uint8arraydecodedPROHeader, byteCursor);
                    byteCursor += PROSize;

                    return PSSHBox;
            },
            playReadyCdmData = function () {
                if (protectionData["com.microsoft.playready"] != undefined) {
                    if (protectionData["com.microsoft.playready"].cdmData != null && protectionData["com.microsoft.playready"].cdmData != '') {

                        var cdmDataArray = [],
                            charCode,
                            cdmData = protectionData["com.microsoft.playready"].cdmData;
                        cdmDataArray.push(239);
                        cdmDataArray.push(187);
                        cdmDataArray.push(191);
                        for (var i = 0, j = cdmData.length; i < j; ++i) {
                            charCode = cdmData.charCodeAt(i);
                            cdmDataArray.push((charCode & 0xFF00) >> 8);
                            cdmDataArray.push(charCode & 0xFF);
                        }

                        return new Uint8Array(cdmDataArray);
                    }
                }
                return null;
            },
            widevineNeedToAddKeySession = function(initData, keySession, event){
                event.target.webkitGenerateKeyRequest("com.widevine.alpha", event.initData);

                return true;
            },
            widevineGetUpdate =  function (event) {
                var xhr = new XMLHttpRequest(),
                    headers = [];
                xhr.open("POST", getLAUrl("", "com.widevine.alpha"), true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = function(e) {
                    if (this.status == 200) {
                        var key = new Uint8Array(this.response);
                        event.target.webkitAddKey("com.widevine.alpha", key, event.initData, event.sessionId);

                        self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, key);
                    } else {
                        self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, null, new Error('DRM: widevine update, XHR status is "' + xhr.statusText + '" (' + xhr.status + '), expected to be 200. readyState is ' + xhr.readyState));
                    }
                }
                xhr.onabort = function () {
                    self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, null, new Error('DRM: widevine update, XHR aborted. status is "' + xhr.statusText + '" (' + xhr.status + '), readyState is ' + xhr.readyState));
                };
                xhr.onerror = function () {
                    self.notify(self.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, null, new Error('DRM: widevine update, XHR error. status is "' + xhr.statusText + '" (' + xhr.status + '), readyState is ' + xhr.readyState));
                };

                var key, headerOverrides = (_protectionData["com.widevine.alpha"]) ? _protectionData["com.widevine.alpha"].headers : null;
                if (headerOverrides) {
                    for (key in headerOverrides) {
                        headers.push({name: key, value: headerOverrides[key]});
                    }
                }
                if (headers) {
                    headers.forEach(function(hdr) {
                        if ('authorization' === hdr.name.toLowerCase()) {
                            xhr.withCredentials = true;
                        }

                        xhr.setRequestHeader(hdr.name, hdr.value);
                    });
                }

                xhr.send(event.message);
            }

        //
        // order by priority. if an mpd contains more than one the first match will win.
        // Entries with the same schemeIdUri can appear multiple times with different keysTypeStrings.
        //
        return [
            {
                schemeIdUri: "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed",
                keysTypeString: "com.widevine.alpha",
                isSupported: function (data) {
                    return this.schemeIdUri === data.schemeIdUri.toLowerCase();},
                needToAddKeySession: widevineNeedToAddKeySession,
                getInitData: function (/*data*/) {
                    // the cenc element in mpd does not contain initdata
                    return null;},
                getUpdate: widevineGetUpdate,
                cdmData: function() {return null;}
            },
            {
                schemeIdUri: "urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95",
                keysTypeString: "com.microsoft.playready",
                isSupported: function (data) {
                    return this.schemeIdUri === data.schemeIdUri.toLowerCase();},
                needToAddKeySession: playReadyNeedToAddKeySession,
                getInitData: playreadyGetInitData,
                getUpdate: playreadyGetUpdate,
                cdmData: playReadyCdmData
            },
            {
                schemeIdUri: "urn:mpeg:dash:mp4protection:2011",
                keysTypeString: "com.widevine.alpha",
                isSupported: function (data) {
                    return this.schemeIdUri === data.schemeIdUri.toLowerCase() && data.value.toLowerCase() === "cenc";},
                needToAddKeySession: widevineNeedToAddKeySession,
                getInitData: function (/*data*/) {
                    // the cenc element in mpd does not contain initdata
                    return null;},
                getUpdate: widevineGetUpdate,
                cdmData: function() {return null;}
            },
            {
                schemeIdUri: "urn:mpeg:dash:mp4protection:2011",
                keysTypeString: "com.microsoft.playready",
                isSupported: function (data) {
                    return this.schemeIdUri === data.schemeIdUri.toLowerCase() && data.value.toLowerCase() === "cenc";},
                needToAddKeySession: playReadyNeedToAddKeySession,
                getInitData: function (/*data*/) {
                    // the cenc element in mpd does not contain initdata
                    return null;},
                getUpdate: playreadyGetUpdate,
                cdmData: playReadyCdmData
            },
            {
                schemeIdUri: "urn:uuid:00000000-0000-0000-0000-000000000000",
                keysTypeString: "webkit-org.w3.clearkey",
                isSupported: function (data) {
                    return this.schemeIdUri === data.schemeIdUri.toLowerCase();},
                needToAddKeySession: function (/*initData, keySessions*/) {
                    return true;},
                getInitData: function (/*data*/) {
                    return null;},
                getUpdate: function (event) {
                    bytes = new Uint16Array(event.message.buffer);
                    msg = String.fromCharCode.apply(null, bytes);
                    return msg;
                },
                cdmData: function() {return null;}
            }
        ];
    },

    addKey: function (element, type, key, data, id) {
        element.webkitAddKey(type, key, data, id);
    },

    generateKeyRequest: function(element, type, data) {
        element.webkitGenerateKeyRequest(type, data);
    },

    listenToNeedKey: function(videoModel, listener) {
        videoModel.listen("webkitneedkey", listener);
        videoModel.listen("msneedkey", listener);
        videoModel.listen("needKey", listener);
    },

    listenToKeyError: function(source, listener) {
        source.addEventListener("webkitkeyerror", listener, false);
        source.addEventListener("mskeyerror", listener, false);
        source.addEventListener("keyerror", listener, false);
    },

    listenToKeyMessage: function(source, listener) {
        source.addEventListener("webkitkeymessage", listener, false);
        source.addEventListener("mskeymessage", listener, false);
        source.addEventListener("keymessage", listener, false);
    },

    listenToKeyAdded: function(source, listener) {
        source.addEventListener("webkitkeyadded", listener, false);
        source.addEventListener("mskeyadded", listener, false);
        source.addEventListener("keyadded", listener, false);
    },

    unlistenToKeyError: function(source, listener) {
        source.removeEventListener("webkitkeyerror", listener);
        source.removeEventListener("mskeyerror", listener);
        source.removeEventListener("keyerror", listener);
    },

    unlistenToKeyMessage: function(source, listener) {
        source.removeEventListener("webkitkeymessage", listener);
        source.removeEventListener("mskeymessage", listener);
        source.removeEventListener("keymessage", listener);
    },

    unlistenToKeyAdded: function(source, listener) {
        source.removeEventListener("webkitkeyadded", listener);
        source.removeEventListener("mskeyadded", listener);
        source.removeEventListener("keyadded", listener);
    }

};;// The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
//
// Copyright (c) 2013, Microsoft Open Technologies, Inc. 
//
// All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//     -             Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//     -             Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//     -             Neither the name of the Microsoft Open Technologies, Inc. nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

MediaPlayer.models.ProtectionModel = function () {
    "use strict";

    var element = null,
        keyAddedListener = null,
        keyErrorListener = null,
        keyMessageListener = null,
        session,
        keySystems = [],

        onKeySystemUpdateCompleted = function(sender, data, error) {
            var hasWebkitGenerateKeyRequest = ('webkitGenerateKeyRequest' in document.createElement('video'));

            if (error) return;

            if (!hasWebkitGenerateKeyRequest) {
                session.update(data);
            }
        };

    return {
        system : undefined,
        protectionExt : undefined,

        setup: function() {
            this.keySystemUpdateCompleted = onKeySystemUpdateCompleted;
        },

        init: function (videoModel) {
            this.videoModel = videoModel;
            element = this.videoModel.getElement();
        },

        addKeySession: function (kid, mediaCodec, initData) {
            var session = null,
                hasWebkitGenerateKeyRequest = ('webkitGenerateKeyRequest' in document.createElement('video'));

            if (!hasWebkitGenerateKeyRequest) {
                session = this.protectionExt.createSession(keySystems[kid].keys, mediaCodec, initData, keySystems[kid].keySystem.cdmData());

                this.protectionExt.listenToKeyAdded(session, keyAddedListener);
                this.protectionExt.listenToKeyError(session, keyErrorListener);
                this.protectionExt.listenToKeyMessage(session, keyMessageListener);
            } else {
                this.protectionExt.listenToKeyMessage(this.videoModel.getElement(), keyMessageListener);
            }

            keySystems[kid].initData = initData;
            keySystems[kid].keySessions.push(session);

            return session;
        },

        addKeySystem: function (kid, contentProtectionData, keySystemDesc) {
            var keysLocal = null;

            keysLocal = this.protectionExt.createMediaKeys(keySystemDesc.keysTypeString);

            this.protectionExt.setMediaKey(element, keysLocal);

            keySystems[kid] = {
                kID : kid,
                contentProtection : contentProtectionData,
                keySystem : keySystemDesc,
                keys : keysLocal,
                initData : null,
                keySessions : []
            };
        },

        removeKeySystem: function (kid) {
            if (kid !== null && keySystems[kid] !== undefined && keySystems[kid].keySessions.length !== 0) {
                var keySessions = keySystems[kid].keySessions;

                for(var kss = 0; kss < keySessions.length; ++kss) {
                    this.protectionExt.unlistenToKeyError(keySessions[kss], keyErrorListener);
                    this.protectionExt.unlistenToKeyAdded(keySessions[kss], keyAddedListener);
                    this.protectionExt.unlistenToKeyMessage(keySessions[kss], keyMessageListener);
                    keySessions[kss].close();
                }

                keySystems[kid] = undefined;
            }
        },

        needToAddKeySession: function (kid, event) {
            var keySystem = null;
            keySystem = keySystems[kid];
            return keySystem.keySystem.needToAddKeySession(keySystem.initData, keySystem.keySessions, event);
        },

        getInitData: function (kid) {
            var keySystem = null;
            keySystem = keySystems[kid];
            return keySystem.keySystem.getInitData(keySystem.contentProtection);
        },

        updateFromMessage: function (kid, sessionValue, event) {
            session = sessionValue;
            keySystems[kid].keySystem.getUpdate(event);
        },
/*
        addKey: function (type, key, data, id) {
            this.protectionExt.addKey(element, type, key, data, id);
        },

        generateKeyRequest: function(type, data) {
            this.protectionExt.webkitGenerateKeyRequest(element, type, data);
        },
*/
        listenToNeedKey: function(listener) {
            this.protectionExt.listenToNeedKey(this.videoModel, listener);
        },

        listenToKeyError: function(listener) {
            keyErrorListener = listener;

            for(var ks = 0; ks < keySystems.length; ++ks) {
                var keySessions = keySystems[ks].keySessions;

                for(var kss = 0; kss < keySessions.length; ++kss) {
                    this.protectionExt.listenToKeyError(keySessions[kss], listener);
                }
            }
        },

        listenToKeyMessage: function(listener) {
            keyMessageListener = listener;

            for(var ks = 0; ks < keySystems.length; ++ks) {
                var keySessions = keySystems[ks].keySessions;

                for(var kss = 0; kss < keySessions.length; ++kss) {
                    this.protectionExt.listenToKeyMessage(keySessions[kss], listener);
                }
            }
        },

        listenToKeyAdded: function(listener) {
            keyAddedListener = listener;

            for(var ks = 0; ks < keySystems.length; ++ks) {
                var keySessions = keySystems[ks].keySessions;

                for(var kss = 0; kss < keySessions.length; ++kss) {
                    this.protectionExt.listenToKeyAdded(keySessions[kss], listener);
                }
            }
        }
    };
};

MediaPlayer.models.ProtectionModel.prototype = {
    constructor: MediaPlayer.models.ProtectionModel
};;MediaPlayer.dependencies.ScheduleController = function () {
    "use strict";

    var fragmentsToLoad = 0,
        type,
        ready,
        fragmentModel,
        isDynamic,
        currentTrackInfo,
        initialPlayback = true,
        lastValidationTime = null,

        isStopped = false,

        playListMetrics = null,
        playListTraceMetrics = null,
        playListTraceMetricsClosed = true,

        clearPlayListTraceMetrics = function (endTime, stopreason) {
            var duration = 0,
                startTime = null;

            if (playListTraceMetricsClosed === false) {
                startTime = playListTraceMetrics.start;
                duration = endTime.getTime() - startTime.getTime();

                playListTraceMetrics.duration = duration;
                playListTraceMetrics.stopreason = stopreason;

                playListTraceMetricsClosed = true;
            }
        },

        doStart = function () {
            if (!ready) return;

            isStopped = false;

            var currentTime = new Date();
            clearPlayListTraceMetrics(currentTime, MediaPlayer.vo.metrics.PlayList.Trace.USER_REQUEST_STOP_REASON);
            playListMetrics = this.metricsModel.addPlayList(type, currentTime, 0, MediaPlayer.vo.metrics.PlayList.INITIAL_PLAY_START_REASON);

            if (initialPlayback) {
                initialPlayback = false;
            }

            this.debug.log("ScheduleController " + type + " start.");

            //this.debug.log("ScheduleController begin " + type + " validation");
            validate.call(this);
        },

        startOnReady = function() {
            if (initialPlayback) {
                getInitRequest.call(this, currentTrackInfo.quality);
            }

            doStart.call(this);
        },

        doStop = function (cancelPending) {
            if (isStopped) return;

            isStopped = true;

            this.debug.log("ScheduleController " + type + " stop.");
            // cancel the requests that have already been created, but not loaded yet.
            if (cancelPending) {
                this.fragmentController.cancelPendingRequestsForModel(fragmentModel);
            }

            clearPlayListTraceMetrics(new Date(), MediaPlayer.vo.metrics.PlayList.Trace.USER_REQUEST_STOP_REASON);
        },

        getNextFragment = function (callback) {
            var self =this,
                rules = self.scheduleRulesCollection.getRules(MediaPlayer.rules.ScheduleRulesCollection.prototype.NEXT_FRAGMENT_RULES);

            self.rulesController.applyRules(rules, self.streamProcessor, callback, null, function(currentValue, newValue) {
                return newValue;
            });
        },

        getInitRequest = function(quality) {
            var self = this,
                request;

            request = self.adapter.getInitRequest(self.streamProcessor, quality);

            if (request !== null) {
                //self.debug.log("Loading initialization: " + request.mediaType + ":" + request.startTime);
                //self.debug.log(request);
                self.fragmentController.prepareFragmentForLoading(self, request);
            }

            return request;
        },

        getRequiredFragmentCount = function(callback) {
            var self =this,
                rules = self.scheduleRulesCollection.getRules(MediaPlayer.rules.ScheduleRulesCollection.prototype.FRAGMENTS_TO_SCHEDULE_RULES);

            self.rulesController.applyRules(rules, self.streamProcessor, callback, fragmentsToLoad, function(currentValue, newValue) {
                return Math.min(currentValue, newValue);
            });
        },

        replaceCanceledPendingRequests = function(canceledRequests) {
            var ln = canceledRequests.length,
            // EPSILON is used to avoid javascript floating point issue, e.g. if request.startTime = 19.2,
            // request.duration = 3.83, than request.startTime + request.startTime = 19.2 + 1.92 = 21.119999999999997
                EPSILON = 0.1,
                request,
                time,
                i;

            for (i = 0; i < ln; i += 1) {
                request = canceledRequests[i];
                time = request.startTime + (request.duration / 2) + EPSILON;
                request = this.adapter.getFragmentRequestForTime(this.streamProcessor, currentTrackInfo, time, false);
                this.fragmentController.prepareFragmentForLoading(this, request);
            }
        },

        onGetRequiredFragmentCount = function(result) {
            var self = this;

            fragmentsToLoad = result.value;

            if (fragmentsToLoad <= 0) {
                self.fragmentController.executePendingRequests();
                return;
            }

            self.abrController.getPlaybackQuality(self.streamProcessor);
            getNextFragment.call(self, onNextFragment.bind(self));
        },

        onNextFragment = function(result) {
            var request = result.value;

            if ((request !== null) && !(request instanceof MediaPlayer.vo.FragmentRequest)) {
                request = this.adapter.getFragmentRequestForTime(this.streamProcessor, currentTrackInfo, request.startTime);
            }

            if (request) {
                fragmentsToLoad--;
                //self.debug.log("Loading fragment: " + request.mediaType + ":" + request.startTime);
                this.fragmentController.prepareFragmentForLoading(this, request);
            } else {
                this.fragmentController.executePendingRequests();
            }
        },

        validate = function () {
            var now = new Date().getTime(),
                isEnoughTimeSinceLastValidation = lastValidationTime ? (now - lastValidationTime > this.fragmentController.getLoadingTime(this)) : true;

            if (!isEnoughTimeSinceLastValidation || isStopped || (this.playbackController.isPaused() && (!this.scheduleWhilePaused || isDynamic))) return;

            lastValidationTime = now;
            getRequiredFragmentCount.call(this, onGetRequiredFragmentCount.bind(this));
        },

        clearMetrics = function () {
            var self = this;

            if (type === null || type === "") {
                return;
            }

            self.metricsModel.clearCurrentMetricsForType(type);
        },

        onDataUpdateCompleted = function(sender, mediaData, trackData) {
            currentTrackInfo = this.adapter.convertDataToTrack(trackData);

            if (!isDynamic) {
                ready = true;
            }

            if (ready) {
                startOnReady.call(this);
            }
        },

        onStreamCompleted = function(sender, model /*, request*/) {
            if (model !== this.streamProcessor.getFragmentModel()) return;

            this.debug.log(type + " Stream is complete.");
            clearPlayListTraceMetrics(new Date(), MediaPlayer.vo.metrics.PlayList.Trace.END_OF_CONTENT_STOP_REASON);
        },

        onMediaFragmentLoadingStart = function(sender, model/*, request*/) {
            var self = this;

            if (model !== self.streamProcessor.getFragmentModel()) return;

            validate.call(self);
        },

        onBytesError = function (/*sender, request*/) {
            doStop.call(this);
        },

        onBytesAppended = function(/*sender, quality, index, ranges*/) {
            addPlaylistTraceMetrics.call(this);
        },

        onDataUpdateStarted = function(/*sender*/) {
            doStop.call(this, false);
        },

        onInitRequested = function(sender, quality) {
            getInitRequest.call(this, quality);
        },

        onBufferCleared = function(sender, startTime, endTime, hasEnoughSpace) {
            // after the data has been removed from the buffer we should remove the requests from the list of
            // the executed requests for which playback time is inside the time interval that has been removed from the buffer
            this.fragmentController.removeExecutedRequestsBeforeTime(fragmentModel, endTime);

            if (hasEnoughSpace) {
                doStart.call(this);
            }
        },

        onBufferLevelStateChanged = function(sender, hasSufficientBuffer) {
            var self = this;

            if (!hasSufficientBuffer && !self.playbackController.isSeeking()) {
                self.debug.log("Stalling " + type + " Buffer: " + type);
                clearPlayListTraceMetrics(new Date(), MediaPlayer.vo.metrics.PlayList.Trace.REBUFFERING_REASON);
            }
        },

        onBufferLevelUpdated = function(sender, newBufferLevel) {
            var self = this;

            self.metricsModel.addBufferLevel(type, new Date(), newBufferLevel);
            validate.call(this);
        },

        onQuotaExceeded = function(/*sender, criticalBufferLevel*/) {
            doStop.call(this, false);
        },

        onQualityChanged = function(sender, typeValue, streamInfo, oldQuality, newQuality) {
            if (type !== typeValue || this.streamProcessor.getStreamInfo().id !== streamInfo.id) return;

            var self = this,
                canceledReqs;

            canceledReqs = fragmentModel.cancelPendingRequests(oldQuality);
            currentTrackInfo = self.streamProcessor.getTrackForQuality(newQuality);

            if (currentTrackInfo === null || currentTrackInfo === undefined) {
                throw "Unexpected error!";
            }

            replaceCanceledPendingRequests.call(self, canceledReqs);
            clearPlayListTraceMetrics(new Date(), MediaPlayer.vo.metrics.PlayList.Trace.REPRESENTATION_SWITCH_STOP_REASON);
        },

        addPlaylistTraceMetrics = function() {
            var self = this,
                currentVideoTime = self.playbackController.getTime(),
                rate = self.playbackController.getPlaybackRate(),
                currentTime = new Date();

            if (playListTraceMetricsClosed === true && currentTrackInfo && playListMetrics) {
                playListTraceMetricsClosed = false;
                playListTraceMetrics = self.metricsModel.appendPlayListTrace(playListMetrics, currentTrackInfo.id, null, currentTime, currentVideoTime, null, rate, null);
            }
        },

        onClosedCaptioningRequested = function(sender, quality) {
            var self = this,
                req = getInitRequest.call(self, quality);

            fragmentModel.executeRequest(req);
        },

        onPlaybackStarted = function(/*sender, startTime*/) {
            doStart.call(this);
        },

        onPlaybackSeeking = function(sender, time) {
            if (!initialPlayback) {
                this.fragmentController.cancelPendingRequestsForModel(fragmentModel);
            }

            var currentTime,
                metrics = this.metricsModel.getMetricsFor("stream"),
                manifestUpdateInfo = this.metricsExt.getCurrentManifestUpdate(metrics);

            this.debug.log("ScheduleController " + type + " seek: " + time);
            currentTime = new Date();
            clearPlayListTraceMetrics(currentTime, MediaPlayer.vo.metrics.PlayList.Trace.USER_REQUEST_STOP_REASON);
            playListMetrics = this.metricsModel.addPlayList(type, currentTime, time, MediaPlayer.vo.metrics.PlayList.SEEK_START_REASON);
            doStart.call(this);

            this.metricsModel.updateManifestUpdateInfo(manifestUpdateInfo, {latency: currentTrackInfo.DVRWindow.end - this.playbackController.getTime()});
        },

        onPlaybackRateChanged = function() {
            addPlaylistTraceMetrics.call(this);
        },

        onWallclockTimeUpdated = function(/*sender*/) {
            validate.call(this);
        },

        onLiveEdgeFound = function(sender, liveEdgeTime/*, searchTime*/) {
            // step back from a found live edge time to be able to buffer some data
            var self = this,
                manifestInfo = currentTrackInfo.mediaInfo.streamInfo.manifestInfo,
                startTime = liveEdgeTime - Math.min((manifestInfo.minBufferTime * 2), manifestInfo.DVRWindowSize / 2),
                request,
                metrics = self.metricsModel.getMetricsFor("stream"),
                manifestUpdateInfo = self.metricsExt.getCurrentManifestUpdate(metrics),
                currentLiveStart = self.playbackController.getLiveStartTime(),
                actualStartTime;
            // get a request for a start time
            request = self.adapter.getFragmentRequestForTime(self.streamProcessor, currentTrackInfo, startTime);
            actualStartTime = request.startTime;

            if (isNaN(currentLiveStart) || (actualStartTime > currentLiveStart)) {
                self.playbackController.setLiveStartTime(actualStartTime);
            }

            self.metricsModel.updateManifestUpdateInfo(manifestUpdateInfo, {currentTime: actualStartTime, presentationStartTime: liveEdgeTime, latency: liveEdgeTime - actualStartTime, clientTimeOffset: self.timelineConverter.getClientTimeOffset()});
            ready = true;
            startOnReady.call(self);
        };

    return {
        debug: undefined,
        system: undefined,
        metricsModel: undefined,
        metricsExt: undefined,
        scheduleWhilePaused: undefined,
        timelineConverter: undefined,
        abrController: undefined,
        adapter: undefined,
        scheduleRulesCollection: undefined,
        rulesController: undefined,
        eventList: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,

        setup: function() {
            this.liveEdgeFound = onLiveEdgeFound;

            this.qualityChanged = onQualityChanged;

            this.dataUpdateStarted = onDataUpdateStarted;
            this.dataUpdateCompleted = onDataUpdateCompleted;

            this.mediaFragmentLoadingStart = onMediaFragmentLoadingStart;
            this.fragmentLoadingFailed = onBytesError;
            this.streamCompleted = onStreamCompleted;

            this.bufferCleared = onBufferCleared;
            this.bytesAppended = onBytesAppended;
            this.bufferLevelStateChanged = onBufferLevelStateChanged;
            this.bufferLevelUpdated = onBufferLevelUpdated;
            this.initRequested = onInitRequested;
            this.quotaExceeded = onQuotaExceeded;

            this.closedCaptioningRequested = onClosedCaptioningRequested;

            this.playbackStarted = onPlaybackStarted;
            this.playbackSeeking = onPlaybackSeeking;
            this.playbackRateChanged = onPlaybackRateChanged;
            this.wallclockTimeUpdated = onWallclockTimeUpdated;
        },

        initialize: function(typeValue, streamProcessor) {
            var self = this;

            type = typeValue;
            self.streamProcessor = streamProcessor;
            self.playbackController = streamProcessor.playbackController;
            self.fragmentController = streamProcessor.fragmentController;
            self.liveEdgeFinder = streamProcessor.liveEdgeFinder;
            self.bufferController = streamProcessor.bufferController;
            isDynamic = streamProcessor.isDynamic();
            fragmentModel = this.fragmentController.getModel(this);

            if (self.scheduleRulesCollection.bufferLevelRule) {
                self.scheduleRulesCollection.bufferLevelRule.setScheduleController(self);
            }

            if (self.scheduleRulesCollection.pendingRequestsRule) {
                self.scheduleRulesCollection.pendingRequestsRule.setScheduleController(self);
            }

            if (self.scheduleRulesCollection.playbackTimeRule) {
                self.scheduleRulesCollection.playbackTimeRule.setScheduleController(self);
            }
        },

        getFragmentModel: function() {
            return fragmentModel;
        },

        reset: function() {
            var self = this;

            doStop.call(self, true);
            self.bufferController.unsubscribe(self.bufferController.eventList.ENAME_BUFFER_LEVEL_OUTRUN, self.scheduleRulesCollection.bufferLevelRule);
            self.bufferController.unsubscribe(self.bufferController.eventList.ENAME_BUFFER_LEVEL_BALANCED, self.scheduleRulesCollection.bufferLevelRule);
            self.fragmentController.abortRequestsForModel(fragmentModel);
            self.fragmentController.detachModel(fragmentModel);
            clearMetrics.call(self);
            fragmentsToLoad = 0;
        },

        start: doStart,
        stop: doStop
    };
};

MediaPlayer.dependencies.ScheduleController.prototype = {
    constructor: MediaPlayer.dependencies.ScheduleController
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.SourceBufferExtensions = function () {
    "use strict";
    this.system = undefined;
    this.errHandler = undefined;
    this.notify = undefined;
    this.subscribe = undefined;
    this.unsubscribe = undefined;
    this.eventList = {
        ENAME_SOURCEBUFFER_REMOVE_COMPLETED: "sourceBufferRemoveCompleted",
        ENAME_SOURCEBUFFER_APPEND_COMPLETED: "sourceBufferAppendCompleted"
    };
};

MediaPlayer.dependencies.SourceBufferExtensions.prototype = {

    constructor: MediaPlayer.dependencies.SourceBufferExtensions,

    createSourceBuffer: function (mediaSource, mediaInfo) {
        "use strict";
        var self = this,
            codec = mediaInfo.codec,
            buffer = null;
        try {
            buffer = mediaSource.addSourceBuffer(codec);
        } catch(ex) {
            if (mediaInfo.isText) {
                buffer = self.system.getObject("textSourceBuffer");
            } else {
                throw ex;
            }
        }

        return buffer;
    },

    removeSourceBuffer: function (mediaSource, buffer) {
        "use strict";

        try {
            mediaSource.removeSourceBuffer(buffer);
        } catch(ex){
        }
    },

    getBufferRange: function (buffer, time, tolerance) {
        "use strict";

        var ranges = null,
            start = 0,
            end = 0,
            firstStart = null,
            lastEnd = null,
            gap = 0,
            toler = (tolerance || 0.15),
            len,
            i;

        try {
            ranges = buffer.buffered;
        } catch(ex) {
            return null;
        }

        if (ranges !== null) {
            for (i = 0, len = ranges.length; i < len; i += 1) {
                start = ranges.start(i);
                end = ranges.end(i);
                if (firstStart === null) {
                    gap = Math.abs(start - time);
                    if (time >= start && time < end) {
                        // start the range
                        firstStart = start;
                        lastEnd = end;
                    } else if (gap <= toler) {
                        // start the range even though the buffer does not contain time 0
                        firstStart = start;
                        lastEnd = end;
                    }
                } else {
                    gap = start - lastEnd;
                    if (gap <= toler) {
                        // the discontinuity is smaller than the tolerance, combine the ranges
                        lastEnd = end;
                    } else {
                        break;
                    }
                }
            }

            if (firstStart !== null) {
                return {start: firstStart, end: lastEnd};
            }
        }

        return null;
    },

    getAllRanges: function(buffer) {
        var ranges = null;

        try{
            ranges = buffer.buffered;
            return ranges;
        } catch (ex) {
            return null;
        }
    },

    getBufferLength: function (buffer, time, tolerance) {
        "use strict";

        var self = this,
            range,
            length;

        range = self.getBufferRange(buffer, time, tolerance);

        if (range === null) {
            length = 0;
        } else {
            length = range.end - time;
        }

        return length;
    },

    waitForUpdateEnd: function(buffer, callback) {
        "use strict";
        var intervalId,
            CHECK_INTERVAL = 50,
            checkIsUpdateEnded = function() {
                // if undating is still in progress do nothing and wait for the next check again.
                if (buffer.updating) return;
                // updating is completed, now we can stop checking and resolve the promise
                clearInterval(intervalId);
                callback(true);
            },
            updateEndHandler = function() {
                if (buffer.updating) return;

                buffer.removeEventListener("updateend", updateEndHandler, false);
                callback(true);
            };

        if (!buffer.updating) {
            callback(true);
            return;
        }

        // use updateend event if possible
        if (typeof buffer.addEventListener === "function") {
            try {
                buffer.addEventListener("updateend", updateEndHandler, false);
            } catch (err) {
                // use setInterval to periodically check if updating has been completed
                intervalId = setInterval(checkIsUpdateEnded, CHECK_INTERVAL);
            }
        } else {
            // use setInterval to periodically check if updating has been completed
            intervalId = setInterval(checkIsUpdateEnded, CHECK_INTERVAL);
        }
    },

    append: function (buffer, bytes) {
        var self = this,
            appendMethod = ("append" in buffer) ? "append" : (("appendBuffer" in buffer) ? "appendBuffer" : null);

        if (!appendMethod) return;

        try {
            self.waitForUpdateEnd(buffer, function() {
                buffer[appendMethod](bytes);

                // updating is in progress, we should wait for it to complete before signaling that this operation is done
                self.waitForUpdateEnd(buffer, function() {
                    self.notify(self.eventList.ENAME_SOURCEBUFFER_APPEND_COMPLETED, buffer, bytes);
                });
            });
        } catch (err) {
            self.notify(self.eventList.ENAME_SOURCEBUFFER_APPEND_COMPLETED, buffer, bytes, err);
        }
    },

    remove: function (buffer, start, end, mediaSource) {
        var self = this;

        try {
            // make sure that the given time range is correct. Otherwise we will get InvalidAccessError
            if ((start >= 0) && (end > start) && (mediaSource.readyState !== "ended")) {
                buffer.remove(start, end);
            }
            // updating is in progress, we should wait for it to complete before signaling that this operation is done
            this.waitForUpdateEnd(buffer, function() {
                self.notify(self.eventList.ENAME_SOURCEBUFFER_REMOVE_COMPLETED, buffer, start, end);
            });
        } catch (err) {
            self.notify(self.eventList.ENAME_SOURCEBUFFER_REMOVE_COMPLETED, buffer, start, end, err);
        }
    },

    abort: function (mediaSource, buffer) {
        "use strict";
        try {
            if (mediaSource.readyState === "open") {
                buffer.abort();
            }
        } catch(ex){
        }
    }
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.Stream = function () {
    "use strict";

    var manifest,
        mediaSource,
        mediaInfos = {},
        streamProcessors = [],
        autoPlay = true,
        initialized = false,
        loaded = false,
        errored = false,
        kid = null,
        initData = [],
        updating = true,
        streamInfo = null,

        needKeyListener,
        keyMessageListener,
        keyAddedListener,
        keyErrorListener,

        eventController = null,

        play = function () {
            //this.debug.log("Attempting play...");

            if (!initialized) {
                return;
            }

            //this.debug.log("Do play.");
            this.playbackController.start();
        },

        pause = function () {
            //this.debug.log("Do pause.");
            this.playbackController.pause();
        },

        seek = function (time) {
            //this.debug.log("Attempting seek...");

            if (!initialized) {
                return;
            }

            this.debug.log("Do seek: " + time);

            this.playbackController.seek(time);
        },

        // Encrypted Media Extensions

        onMediaSourceNeedsKey = function (event) {
            var self = this,
                mediaInfo = mediaInfos.video,
                videoCodec = mediaInfos ? mediaInfos.video.codec : null,
                type;

            type = (event.type !== "msneedkey") ? event.type : videoCodec;
            initData.push({type: type, initData: event.initData});

            this.debug.log("DRM: Key required for - " + type);
            //this.debug.log("DRM: Generating key request...");
            //this.protectionModel.generateKeyRequest(DEFAULT_KEY_TYPE, event.initData);
            if (mediaInfo && !!videoCodec && !kid) {
                try
                {
                    kid = self.protectionController.selectKeySystem(mediaInfo);
                }
                catch (error)
                {
                    pause.call(self);
                    self.debug.log(error);
                    self.errHandler.mediaKeySystemSelectionError(error);
                }
            }

            if (!!kid) {
                self.protectionController.ensureKeySession(kid, type, event);
            }
        },

        onMediaSourceKeyMessage = function (event) {
            var self = this,
                session = null,
                bytes = null,
                msg = null,
                laURL = null;

            this.debug.log("DRM: Got a key message...");

            session = event.target;

            self.protectionController.updateFromMessage(kid, session, event);

            //if (event.keySystem !== DEFAULT_KEY_TYPE) {
            //    this.debug.log("DRM: Key type not supported!");
            //}
            // else {
                // todo : request license?
                //requestLicense(e.message, e.sessionId, this);
            // }
        },

        onMediaSourceKeyAdded = function () {
            this.debug.log("DRM: Key added.");
        },

        onMediaSourceKeyError = function () {
            var session = event.target,
                msg;
            msg = 'DRM: MediaKeyError - sessionId: ' + session.sessionId + ' errorCode: ' + session.error.code + ' systemErrorCode: ' + session.error.systemCode + ' [';
            switch (session.error.code) {
                case 1:
                    msg += "MEDIA_KEYERR_UNKNOWN - An unspecified error occurred. This value is used for errors that don't match any of the other codes.";
                    break;
                case 2:
                    msg += "MEDIA_KEYERR_CLIENT - The Key System could not be installed or updated.";
                    break;
                case 3:
                    msg += "MEDIA_KEYERR_SERVICE - The message passed into update indicated an error from the license service.";
                    break;
                case 4:
                    msg += "MEDIA_KEYERR_OUTPUT - There is no available output device with the required characteristics for the content protection system.";
                    break;
                case 5:
                    msg += "MEDIA_KEYERR_HARDWARECHANGE - A hardware configuration change caused a content protection error.";
                    break;
                case 6:
                    msg += "MEDIA_KEYERR_DOMAIN - An error occurred in a multi-device domain licensing configuration. The most common error is a failure to join the domain.";
                    break;
            }
            msg += "]";
            //pause.call(this);
            this.debug.log(msg);
            this.errHandler.mediaKeySessionError(msg);
        },

        // Media Source

        setUpMediaSource = function (mediaSourceArg, callback) {
            var self = this,

                onMediaSourceOpen = function (e) {
                    self.debug.log("MediaSource is open!");
                    self.debug.log(e);

                    mediaSourceArg.removeEventListener("sourceopen", onMediaSourceOpen);
                    mediaSourceArg.removeEventListener("webkitsourceopen", onMediaSourceOpen);

                    callback(mediaSourceArg);
                };

            //self.debug.log("MediaSource should be closed. The actual readyState is: " + mediaSourceArg.readyState);

            mediaSourceArg.addEventListener("sourceopen", onMediaSourceOpen, false);
            mediaSourceArg.addEventListener("webkitsourceopen", onMediaSourceOpen, false);

            self.mediaSourceExt.attachMediaSource(mediaSourceArg, self.videoModel);

            //self.debug.log("MediaSource attached to video.  Waiting on open...");
        },

        tearDownMediaSource = function () {
            var self = this,
                ln = streamProcessors.length,
                i = 0,
                processor;

            for (i; i < ln; i += 1) {
                processor = streamProcessors[i];
                processor.reset(errored);
                processor = null;
            }
            if(!!eventController) {
                eventController.reset();
            }

            streamProcessors = [];

            if (!!mediaSource) {
                self.mediaSourceExt.detachMediaSource(self.videoModel);
            }

            initialized = false;

            kid = null;
            initData = [];

            mediaInfos = {};

            mediaSource = null;
            manifest = null;
        },

        initializeMediaForType = function(type, manifest) {
            var self = this,
                mimeType,
                codec,
                getCodecOrMimeType = function(mediaInfo) {
                    return mediaInfo.codec;
                },
                processor,
                mediaInfo = self.adapter.getMediaInfoForType(manifest, streamInfo, type);

            if (type === "text") {
                getCodecOrMimeType = function(mediaInfo) {
                    mimeType = mediaInfo.mimeType;

                    return mimeType;
                };
            }

            if (mediaInfo !== null) {
                //self.debug.log("Create " + type + " buffer.");
                var codecOrMime = getCodecOrMimeType.call(self, mediaInfo),
                    contentProtectionData,
                    buffer = null;

                if (codecOrMime === mimeType) {
                    try{
                        buffer = self.sourceBufferExt.createSourceBuffer(mediaSource, mediaInfo);
                    } catch (e) {
                        self.errHandler.mediaSourceError("Error creating " + type +" source buffer.");
                    }
                } else {
                    codec = codecOrMime;
                    self.debug.log(type + " codec: " + codec);
                    mediaInfos[type] = mediaInfo;

                    contentProtectionData = mediaInfo.contentProtection;

                    if (!!contentProtectionData && !self.capabilities.supportsMediaKeys()) {
                        self.errHandler.capabilityError("mediakeys");
                    } else {
                        //kid = self.protectionController.selectKeySystem(codec, contentProtection);
                        //self.protectionController.ensureKeySession(kid, codec, null);

                        if (!self.capabilities.supportsCodec(self.videoModel.getElement(), codec)) {
                            var msg = type + "Codec (" + codec + ") is not supported.";
                            self.errHandler.manifestError(msg, "codec", manifest);
                            self.debug.log(msg);
                        } else {
                            try {
                                buffer = self.sourceBufferExt.createSourceBuffer(mediaSource, mediaInfo);
                            } catch (e) {
                                self.errHandler.mediaSourceError("Error creating " + type +" source buffer.");
                            }
                        }
                    }
                }

                if (buffer === null) {
                    self.debug.log("No buffer was created, skipping " + type + " data.");
                } else {
                    // TODO : How to tell index handler live/duration?
                    // TODO : Pass to controller and then pass to each method on handler?

                    processor = self.system.getObject("streamProcessor");
                    streamProcessors.push(processor);
                    processor.initialize(mimeType || type, buffer, self.videoModel, self.fragmentController, self.playbackController, mediaSource, self, eventController);
                    processor.setMediaInfo(mediaInfo);
                    self.adapter.updateData(processor);
                    //self.debug.log(type + " is ready!");
                }


            } else {
                self.debug.log("No " + type + " data.");
            }
        },

        initializeMediaSource = function () {
            //this.debug.log("Getting MediaSource ready...");

            var self = this,
                events;

            eventController = self.system.getObject("eventController");
            eventController.initialize(self.videoModel);
            events = self.adapter.getEventsFor(streamInfo);
            eventController.addInlineEvents(events);
            // Figure out some bits about the stream before building anything.
            //self.debug.log("Gathering information for buffers. (1)");

            initializeMediaForType.call(self, "video", manifest);
            initializeMediaForType.call(self, "audio", manifest);
            initializeMediaForType.call(self, "text", manifest);

            //this.debug.log("MediaSource initialized!");
        },

        initializePlayback = function () {
            var self = this,
                manifestDuration,
                mediaDuration;

            //self.debug.log("Getting ready for playback...");

            manifestDuration = streamInfo.manifestInfo.duration;
            mediaDuration = self.mediaSourceExt.setDuration(mediaSource, manifestDuration);
            self.debug.log("Duration successfully set to: " + mediaDuration);
            initialized = true;
            checkIfInitializationCompleted.call(self);
        },

        onLoad = function () {
            this.debug.log("element loaded!");
            loaded = true;
            startAutoPlay.call(this);
        },

        startAutoPlay = function() {
            if (!initialized || !loaded) return;

            // only first stream must be played automatically during playback initialization
            if (streamInfo.index === 0) {
                eventController.start();
                if (autoPlay) {
                    play.call(this);
                }
            }
        },

        checkIfInitializationCompleted = function() {
            var self = this,
                ln = streamProcessors.length,
                i = 0;

            if (!initialized) return;

            for (i; i < ln; i += 1) {
                if (streamProcessors[i].isUpdating()) return;
            }

            updating = false;
            self.notify(self.eventList.ENAME_STREAM_UPDATED);
        },

        onError = function (sender, error) {
            var code = error.code,
                msg = "";

            if (code === -1) {
                // not an error!
                return;
            }

            switch (code) {
                case 1:
                    msg = "MEDIA_ERR_ABORTED";
                    break;
                case 2:
                    msg = "MEDIA_ERR_NETWORK";
                    break;
                case 3:
                    msg = "MEDIA_ERR_DECODE";
                    break;
                case 4:
                    msg = "MEDIA_ERR_SRC_NOT_SUPPORTED";
                    break;
                case 5:
                    msg = "MEDIA_ERR_ENCRYPTED";
                    break;
            }

            errored = true;

            this.debug.log("Video Element Error: " + msg);
            this.debug.log(error);
            this.errHandler.mediaSourceError(msg);
            this.reset();
        },

        doLoad = function (manifestResult) {

            var self = this,
                onMediaSourceSetup = function (mediaSourceResult) {
                    mediaSource = mediaSourceResult;
                    //self.debug.log("MediaSource set up.");
                    initializeMediaSource.call(self);

                    if (streamProcessors.length === 0) {
                        var msg = "No streams to play.";
                        self.errHandler.manifestError(msg, "nostreams", manifest);
                        self.debug.log(msg);
                    } else {
                        self.liveEdgeFinder.initialize(streamProcessors[0]);
                        self.liveEdgeFinder.subscribe(self.liveEdgeFinder.eventList.ENAME_LIVE_EDGE_FOUND, self.playbackController);
                        initializePlayback.call(self);
                        //self.debug.log("Playback initialized!");
                        startAutoPlay.call(self);
                    }
                },
                mediaSourceResult;

            //self.debug.log("Stream start loading.");

            manifest = manifestResult;
            mediaSourceResult = self.mediaSourceExt.createMediaSource();
            //self.debug.log("MediaSource created.");

            setUpMediaSource.call(self, mediaSourceResult, onMediaSourceSetup);
        },

        onBufferingCompleted = function() {
            var processors = getAudioVideoProcessors(),
                ln = processors.length,
                i = 0;

            // if there is at least one buffer controller that has not completed buffering yet do nothing
            for (i; i < ln; i += 1) {
                if (!processors[i].isBufferingCompleted()) return;
            }

            // buffering has been complted, now we can signal end of stream
            if (mediaSource && streamInfo.isLast) {
                this.mediaSourceExt.signalEndOfStream(mediaSource);
            }
        },

        onDataUpdateCompleted = function(/*sender, mediaData, trackData*/) {
            checkIfInitializationCompleted.call(this);
        },

        onKeySystemUpdateCompleted = function(sender, data, error) {
            if (!error) return;

            pause.call(this);
            this.debug.log(error);
            this.errHandler.mediaKeyMessageError(error);
        },

        getAudioVideoProcessors = function() {
            var arr = [],
                i = 0,
                ln = streamProcessors.length,
                type,
                proc;

            for (i; i < ln; i += 1) {
                proc = streamProcessors[i];
                type = proc.getType();

                if (type === "audio" || type === "video") {
                    arr.push(proc);
                }
            }

            return arr;
        },

        updateData = function (updatedStreamInfo) {
            var self = this,
                ln = streamProcessors.length,
                i = 0,
                mediaInfo,
                events,
                processor;

            updating = true;
            manifest = self.manifestModel.getValue();
            streamInfo = updatedStreamInfo;
            self.debug.log("Manifest updated... set new data on buffers.");

            if (eventController) {
                events = self.adapter.getEventsFor(streamInfo);
                eventController.addInlineEvents(events);
            }

            for (i; i < ln; i +=1) {
                processor = streamProcessors[i];
                mediaInfo = self.adapter.getMediaInfoForType(manifest, streamInfo, processor.getType());
                processor.setMediaInfo(mediaInfo);
                this.adapter.updateData(processor);
            }
        };

    return {
        system: undefined,
        manifestModel: undefined,
        mediaSourceExt: undefined,
        sourceBufferExt: undefined,
        adapter: undefined,
        fragmentController: undefined,
        playbackController: undefined,
        protectionModel: undefined,
        protectionController: undefined,
        protectionExt: undefined,
        capabilities: undefined,
        debug: undefined,
        errHandler: undefined,
        liveEdgeFinder: undefined,
        abrController: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_STREAM_UPDATED: "streamUpdated"
        },

        setup: function () {
            this.bufferingCompleted = onBufferingCompleted;
            this.dataUpdateCompleted = onDataUpdateCompleted;
            this.playbackError = onError;
            this.playbackMetaDataLoaded = onLoad;
            this.keySystemUpdateCompleted = onKeySystemUpdateCompleted;
        },

        load: function(manifest) {
            doLoad.call(this, manifest);
        },

        setVideoModel: function(value) {
            this.videoModel = value;
        },

        initProtection: function(protectionData) {
            needKeyListener = onMediaSourceNeedsKey.bind(this);
            keyMessageListener = onMediaSourceKeyMessage.bind(this);
            keyAddedListener = onMediaSourceKeyAdded.bind(this);
            keyErrorListener = onMediaSourceKeyError.bind(this);

            this.protectionModel = this.system.getObject("protectionModel");
            this.protectionModel.init(this.getVideoModel());
            this.protectionController = this.system.getObject("protectionController");
            this.protectionController.init(this.videoModel, this.protectionModel, protectionData);

            this.protectionModel.listenToNeedKey(needKeyListener);
            this.protectionModel.listenToKeyMessage(keyMessageListener);
            this.protectionModel.listenToKeyError(keyErrorListener);
            this.protectionModel.listenToKeyAdded(keyAddedListener);

            this.protectionExt.subscribe(this.protectionExt.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, this.protectionModel);
            this.protectionExt.subscribe(this.protectionExt.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, this);
        },

        getVideoModel: function() {
            return this.videoModel;
        },

        setAutoPlay: function (value) {
            autoPlay = value;
        },

        getAutoPlay: function () {
            return autoPlay;
        },

        reset: function () {
            pause.call(this);

            tearDownMediaSource.call(this);
            if (!!this.protectionController) {
                this.protectionController.teardownKeySystem(kid);
            }

            if (this.protectionModel) {
                this.protectionExt.unsubscribe(this.protectionExt.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, this.protectionModel);
            }

            this.protectionExt.unsubscribe(this.protectionExt.eventList.ENAME_KEY_SYSTEM_UPDATE_COMPLETED, this);
            this.protectionController = undefined;
            this.protectionModel = undefined;
            this.fragmentController = undefined;
            this.playbackController.unsubscribe(this.playbackController.eventList.ENAME_PLAYBACK_ERROR, this);
            this.playbackController.unsubscribe(this.playbackController.eventList.ENAME_PLAYBACK_METADATA_LOADED, this);
            this.playbackController.reset();
            this.liveEdgeFinder.abortSearch();
            this.liveEdgeFinder.unsubscribe(this.liveEdgeFinder.eventList.ENAME_LIVE_EDGE_FOUND, this.playbackController);

            // streamcontroller expects this to be valid
            //this.videoModel = null;

            loaded = false;
        },

        getDuration: function () {
            return streamInfo.duration;
        },

        getStartTime: function() {
            return streamInfo.start;
        },

        getStreamIndex: function() {
            return streamInfo.index;
        },

        getId: function() {
            return streamInfo.id;
        },

        setStreamInfo: function(stream) {
            streamInfo = stream;
        },

        getStreamInfo: function() {
            return streamInfo;
        },
        startEventController: function() {
            eventController.start();
        },
        resetEventController: function() {
            eventController.reset();
        },

        setPlaybackController: function(value) {
            this.playbackController = value;
            value.initialize(streamInfo, this.videoModel);
        },

        getPlaybackController: function() {
            return this.playbackController;
        },

        isUpdating: function() {
            return updating;
        },

        updateData: updateData,
        play: play,
        seek: seek,
        pause: pause
    };
};

MediaPlayer.dependencies.Stream.prototype = {
    constructor: MediaPlayer.dependencies.Stream
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
 MediaPlayer.dependencies.StreamController = function () {
    "use strict";

    /*
     * StreamController aggregates all streams defined in the manifest file
     * and implements corresponding logic to switch between them.
     */

    var streams = [],
        activeStream,
        //TODO set correct value for threshold
        STREAM_BUFFER_END_THRESHOLD = 6,
        STREAM_END_THRESHOLD = 0.2,
        autoPlay = true,
        protectionData,
        isStreamSwitchingInProgress = false,

        play = function () {
            activeStream.play();
        },

        pause = function () {
            activeStream.pause();
        },

        seek = function (time) {
            activeStream.seek(time);
        },

        /*
         * Replaces the currently displayed <video> with a new data and corresponding <video> element.
         *
         * @param fromVideoModel Currently used video data
         * @param toVideoModel New video data to be displayed
         *
         * TODO - move method to appropriate place - VideoModelExtensions??
         */
        switchVideoModel = function (fromStream, toStream) {
            var activeVideoElement = fromStream.getVideoModel().getElement(),
                newVideoElement = toStream.getVideoModel().getElement();

            if (!newVideoElement.parentNode) {
                activeVideoElement.parentNode.insertBefore(newVideoElement, activeVideoElement);
            }

            // We use width property to hide/show video element because when using display="none"/"block" playback
            // sometimes stops after switching.
            activeVideoElement.style.width = "0px";
            newVideoElement.style.width = "100%";

            copyVideoProperties(activeVideoElement, newVideoElement);
            detachVideoEvents.call(this, fromStream);
            attachVideoEvents.call(this, toStream);
        },

        attachVideoEvents = function (stream) {
            var playbackCtrl = stream.getPlaybackController();

            playbackCtrl.subscribe(playbackCtrl.eventList.ENAME_PLAYBACK_STARTED, this.manifestUpdater);
            playbackCtrl.subscribe(playbackCtrl.eventList.ENAME_PLAYBACK_PAUSED, this.manifestUpdater);
            playbackCtrl.subscribe(playbackCtrl.eventList.ENAME_PLAYBACK_SEEKING, this);
            playbackCtrl.subscribe(playbackCtrl.eventList.ENAME_PLAYBACK_TIME_UPDATED, this);
            playbackCtrl.subscribe(playbackCtrl.eventList.ENAME_PLAYBACK_PROGRESS, this);
        },

        detachVideoEvents = function (stream) {
            var self = this,
                playbackCtrl = stream.getPlaybackController();
            // setTimeout is used to avoid an exception caused by unsubscibing from PLAYBACK_TIME_UPDATED event
            // inside the event handler
            setTimeout(function(){
                playbackCtrl.unsubscribe(playbackCtrl.eventList.ENAME_PLAYBACK_STARTED, self.manifestUpdater);
                playbackCtrl.unsubscribe(playbackCtrl.eventList.ENAME_PLAYBACK_PAUSED, self.manifestUpdater);
                playbackCtrl.unsubscribe(playbackCtrl.eventList.ENAME_PLAYBACK_SEEKING, self);
                playbackCtrl.unsubscribe(playbackCtrl.eventList.ENAME_PLAYBACK_TIME_UPDATED, self);
                playbackCtrl.unsubscribe(playbackCtrl.eventList.ENAME_PLAYBACK_PROGRESS, self);
            },1);
        },

        copyVideoProperties = function (fromVideoElement, toVideoElement) {
            ["controls", "loop", "muted", "volume"].forEach( function(prop) {
                toVideoElement[prop] = fromVideoElement[prop];
            });
        },

        /*
         * Called when more data is buffered.
         * Used to determine the time current stream is almost buffered and we can start buffering of the next stream.
         * TODO move to ???Extensions class
         */
        onProgress = function(sender, ranges, remainingUnbufferedDuration) {
            if (!remainingUnbufferedDuration || (remainingUnbufferedDuration >= STREAM_BUFFER_END_THRESHOLD)) return;

            onStreamBufferingEnd();
        },

        /*
         * Called when current playback positon is changed.
         * Used to determine the time current stream is finished and we should switch to the next stream.
         * TODO move to ???Extensions class
         */
        onTimeupdate = function(sender, timeToStreamEnd) {
            var self = this;

            self.metricsModel.addDroppedFrames("video", self.videoExt.getPlaybackQuality(activeStream.getVideoModel().getElement()));

            if (!getNextStream()) return;

            // Sometimes after seeking timeUpdateHandler is called before seekingHandler and a new stream starts
            // from beginning instead of from a chosen position. So we do nothing if the player is in the seeking state
            if (activeStream.getVideoModel().getElement().seeking) return;

            // check if stream end is reached
            if (timeToStreamEnd < STREAM_END_THRESHOLD) {
                switchStream.call(this, activeStream, getNextStream());
            }
        },

        /*
         * Called when Seeking event is occured.
         * TODO move to ???Extensions class
         */
        onSeeking = function(sender, seekingTime/*, isProgrammatic*/) {
            var seekingStream = getStreamForTime(seekingTime);

            if (seekingStream && seekingStream !== activeStream) {
                switchStream.call(this, activeStream, seekingStream, seekingTime);
            }
        },

        /*
         * Handles the current stream buffering end moment to start the next stream buffering
         */
        onStreamBufferingEnd = function() {
            var nextStream = getNextStream();
            if (nextStream) {
                nextStream.seek(nextStream.getStartTime());
            }
        },

        getNextStream = function() {
            var nextIndex = activeStream.getStreamIndex() + 1;
            return (nextIndex < streams.length) ? streams[nextIndex] : null;
        },

        getStreamForTime = function(time) {
            var duration = 0,
                stream = null,
                ln = streams.length;

            if (ln > 0) {
                duration += streams[0].getStartTime();
            }

            for (var i = 0; i < ln; i++) {
                stream = streams[i];
                duration += stream.getDuration();

                if (time < duration) {
                    return stream;
                }
            }

            return null;
        },

        //  TODO move to ???Extensions class
        createVideoModel = function() {
            var model = this.system.getObject("videoModel"),
                video = document.createElement("video");
            model.setElement(video);
            return model;
        },

        removeVideoElement = function(element) {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        },

        switchStream = function(from, to, seekTo) {

            if(isStreamSwitchingInProgress || !from || !to || from === to) return;

            isStreamSwitchingInProgress = true;

            from.pause();
            activeStream = to;

            switchVideoModel.call(this, from, to);

            if (seekTo) {
                seek(from.getPlaybackController().getTime());
            } else {
                seek(to.getStartTime());
            }

            play();
            from.resetEventController();
            activeStream.startEventController();
            isStreamSwitchingInProgress = false;
        },

        composeStreams = function() {
            var self = this,
                manifest = self.manifestModel.getValue(),
                metrics = self.metricsModel.getMetricsFor("stream"),
                manifestUpdateInfo = self.metricsExt.getCurrentManifestUpdate(metrics),
                playbackCtrl,
                streamInfo,
                pLen,
                sLen,
                pIdx,
                sIdx,
                streamsInfo,
                stream;

            if (!manifest) return;

            streamsInfo = self.adapter.getStreamsInfo(manifest);

            try {
                if (streamsInfo.length === 0) {
                    throw new Error("There are no streams");
                }

                self.metricsModel.updateManifestUpdateInfo(manifestUpdateInfo, {currentTime: self.videoModel.getCurrentTime(),
                    buffered: self.videoModel.getElement().buffered, presentationStartTime: streamsInfo[0].start,
                    clientTimeOffset: self.timelineConverter.getClientTimeOffset()});

                for (pIdx = 0, pLen = streamsInfo.length; pIdx < pLen; pIdx += 1) {
                    streamInfo = streamsInfo[pIdx];
                    for (sIdx = 0, sLen = streams.length; sIdx < sLen; sIdx += 1) {
                        // If the stream already exists we just need to update the values we got from the updated manifest
                        if (streams[sIdx].getId() === streamInfo.id) {
                            stream = streams[sIdx];
                            stream.updateData(streamInfo);
                        }
                    }
                    // If the Stream object does not exist we probably loaded the manifest the first time or it was
                    // introduced in the updated manifest, so we need to create a new Stream and perform all the initialization operations
                    if (!stream) {
                        stream = self.system.getObject("stream");
                        playbackCtrl = self.system.getObject("playbackController");
                        stream.setStreamInfo(streamInfo);
                        stream.setVideoModel(pIdx === 0 ? self.videoModel : createVideoModel.call(self));
                        stream.setPlaybackController(playbackCtrl);
                        playbackCtrl.subscribe(playbackCtrl.eventList.ENAME_PLAYBACK_ERROR, stream);
                        playbackCtrl.subscribe(playbackCtrl.eventList.ENAME_PLAYBACK_METADATA_LOADED, stream);
                        stream.initProtection(protectionData);
                        stream.setAutoPlay(autoPlay);
                        stream.load(manifest);
                        stream.subscribe(stream.eventList.ENAME_STREAM_UPDATED, self);
                        streams.push(stream);
                    }
                    self.metricsModel.addManifestUpdateStreamInfo(manifestUpdateInfo, streamInfo.id, streamInfo.index, streamInfo.start, streamInfo.duration);
                    stream = null;
                }

                // If the active stream has not been set up yet, let it be the first Stream in the list
                if (!activeStream) {
                    activeStream = streams[0];
                    attachVideoEvents.call(self, activeStream);
                    activeStream.subscribe(activeStream.eventList.ENAME_STREAM_UPDATED, this.liveEdgeFinder);
                }
            } catch(e) {
                self.errHandler.manifestError(e.message, "nostreamscomposed", self.manifestModel.getValue());
                self.reset();
            }
        },

        onStreamUpdated = function() {
            var self = this,
                ln = streams.length,
                i = 0;

            for (i; i < ln; i += 1) {
                if (streams[i].isUpdating()) return;
            }

            self.notify(self.eventList.ENAME_STREAMS_COMPOSED);
        },

        onManifestLoaded = function(sender, manifest, error) {
            if (!error) {
                this.manifestModel.setValue(manifest);
                this.debug.log("Manifest has loaded.");
                //self.debug.log(self.manifestModel.getValue());
                composeStreams.call(this);
            } else {
                this.reset();
            }
        };

    return {
        system: undefined,
        videoModel: undefined,
        manifestLoader: undefined,
        manifestUpdater: undefined,
        manifestModel: undefined,
        adapter: undefined,
        debug: undefined,
        metricsModel: undefined,
        metricsExt: undefined,
        videoExt: undefined,
        liveEdgeFinder: undefined,
        timelineConverter: undefined,
        errHandler: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_STREAMS_COMPOSED: "streamsComposed"
        },

        setup: function() {
            this.manifestLoaded = onManifestLoaded;
            this.streamUpdated = onStreamUpdated;

            this.playbackSeeking = onSeeking;
            this.playbackProgress = onProgress;
            this.playbackTimeUpdated = onTimeupdate;
        },

        setAutoPlay: function (value) {
            autoPlay = value;
        },

        getAutoPlay: function () {
            return autoPlay;
        },

        setProtectionData: function (value) {
            protectionData = value;
        },

        getVideoModel: function () {
            return this.videoModel;
        },

        setVideoModel: function (value) {
            this.videoModel = value;
        },

        getActiveStreamInfo: function() {
            return activeStream ? activeStream.getStreamInfo() : null;
        },

        load: function (url) {
            this.manifestLoader.load(url);
        },

        reset: function () {

            if (!!activeStream) {
                detachVideoEvents.call(this, activeStream);
            }

            for (var i = 0, ln = streams.length; i < ln; i++) {
                var stream = streams[i];
                stream.unsubscribe(stream.eventList.ENAME_STREAM_UPDATED, this);
                stream.reset();
                // we should not remove the video element for the active stream since it is the element users see at the page
                if (stream !== activeStream) {
                    removeVideoElement(stream.getVideoModel().getElement());
                }
            }

            streams = [];
            this.manifestUpdater.stop();
            this.metricsModel.clearAllCurrentMetrics();
            this.manifestModel.setValue(null);
            this.timelineConverter.reset();
            this.adapter.reset();
            isStreamSwitchingInProgress = false;
            activeStream = null;
        },

        play: play,
        seek: seek,
        pause: pause
    };
};

MediaPlayer.dependencies.StreamController.prototype = {
    constructor: MediaPlayer.dependencies.StreamController
};
;MediaPlayer.dependencies.StreamProcessor = function () {
    "use strict";

    var isDynamic,
        stream,
        mediaInfo,
        type,
        eventController,

        createBufferControllerForType = function(type) {
            var self = this,
            controllerName = (type === "video" || type === "audio") ? "bufferController" : "textController";

            return self.system.getObject(controllerName);
        };

    return {
        system : undefined,
        indexHandler: undefined,
        liveEdgeFinder: undefined,
        timelineConverter: undefined,
        eventList: undefined,
        abrController: undefined,
        baseURLExt: undefined,
        adapter: undefined,

        initialize: function (typeValue, buffer, videoModel, fragmentController, playbackController, mediaSource, streamValue, eventControllerValue) {

            var self = this,
                trackController = self.system.getObject("trackController"),
                scheduleController = self.system.getObject("scheduleController"),
                liveEdgeFinder = self.liveEdgeFinder,
                abrController = self.abrController,
                indexHandler = self.indexHandler,
                baseUrlExt = self.baseURLExt,
                fragmentModel,
                fragmentLoader = this.system.getObject("fragmentLoader"),
                bufferController = createBufferControllerForType.call(self, typeValue);

            stream = streamValue;
            type = typeValue;
            eventController = eventControllerValue;

            isDynamic = stream.getStreamInfo().manifestInfo.isDynamic;
            self.bufferController = bufferController;
            self.playbackController = playbackController;
            self.scheduleController = scheduleController;
            self.trackController = trackController;
            self.videoModel = videoModel;
            self.fragmentController = fragmentController;
            self.fragmentLoader = fragmentLoader;

            trackController.subscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, bufferController);
            fragmentController.subscribe(fragmentController.eventList.ENAME_INIT_FRAGMENT_LOADED, bufferController);
            bufferController.subscribe(bufferController.eventList.ENAME_CLOSED_CAPTIONING_REQUESTED, scheduleController);

            if (type === "video" || type === "audio") {
                abrController.subscribe(abrController.eventList.ENAME_QUALITY_CHANGED, bufferController);
                abrController.subscribe(abrController.eventList.ENAME_QUALITY_CHANGED, trackController);
                abrController.subscribe(abrController.eventList.ENAME_QUALITY_CHANGED, scheduleController);

                liveEdgeFinder.subscribe(liveEdgeFinder.eventList.ENAME_LIVE_EDGE_FOUND, this.timelineConverter);
                liveEdgeFinder.subscribe(liveEdgeFinder.eventList.ENAME_LIVE_EDGE_FOUND, trackController);
                liveEdgeFinder.subscribe(liveEdgeFinder.eventList.ENAME_LIVE_EDGE_FOUND, scheduleController);

                trackController.subscribe(trackController.eventList.ENAME_DATA_UPDATE_STARTED, scheduleController);

                trackController.subscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, scheduleController);
                trackController.subscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, abrController);
                trackController.subscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, stream);

                if (!playbackController.streamProcessor) {
                    playbackController.streamProcessor = self;
                    trackController.subscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, playbackController);
                }

                fragmentController.subscribe(fragmentController.eventList.ENAME_MEDIA_FRAGMENT_LOADED, bufferController);
                fragmentController.subscribe(fragmentController.eventList.ENAME_MEDIA_FRAGMENT_LOADING_START, scheduleController);
                fragmentController.subscribe(fragmentController.eventList.ENAME_STREAM_COMPLETED, scheduleController);
                fragmentController.subscribe(fragmentController.eventList.ENAME_STREAM_COMPLETED, bufferController);
                fragmentController.subscribe(fragmentController.eventList.ENAME_STREAM_COMPLETED, scheduleController.scheduleRulesCollection.bufferLevelRule);

                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_STATE_CHANGED, videoModel);
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_CLEARED, scheduleController);
                bufferController.subscribe(bufferController.eventList.ENAME_BYTES_APPENDED, scheduleController);
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_UPDATED, scheduleController);
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_UPDATED, trackController);
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_STATE_CHANGED, scheduleController);
                bufferController.subscribe(bufferController.eventList.ENAME_INIT_REQUESTED, scheduleController);
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFERING_COMPLETED, stream);
                bufferController.subscribe(bufferController.eventList.ENAME_QUOTA_EXCEEDED, scheduleController);
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_OUTRUN, scheduleController.scheduleRulesCollection.bufferLevelRule);
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_BALANCED, scheduleController.scheduleRulesCollection.bufferLevelRule);
                bufferController.subscribe(bufferController.eventList.ENAME_BYTES_APPENDED, playbackController);

                playbackController.subscribe(playbackController.eventList.ENAME_PLAYBACK_PROGRESS, bufferController);
                playbackController.subscribe(playbackController.eventList.ENAME_PLAYBACK_TIME_UPDATED, bufferController);
                playbackController.subscribe(playbackController.eventList.ENAME_PLAYBACK_RATE_CHANGED, bufferController);
                playbackController.subscribe(playbackController.eventList.ENAME_PLAYBACK_RATE_CHANGED, scheduleController);
                playbackController.subscribe(playbackController.eventList.ENAME_PLAYBACK_SEEKING, bufferController);
                playbackController.subscribe(playbackController.eventList.ENAME_PLAYBACK_SEEKING, scheduleController);
                playbackController.subscribe(playbackController.eventList.ENAME_PLAYBACK_STARTED, scheduleController);
                playbackController.subscribe(playbackController.eventList.ENAME_PLAYBACK_SEEKING, scheduleController.scheduleRulesCollection.playbackTimeRule);

                if (isDynamic) {
                    playbackController.subscribe(playbackController.eventList.ENAME_WALLCLOCK_TIME_UPDATED, trackController);
                }

                playbackController.subscribe(playbackController.eventList.ENAME_WALLCLOCK_TIME_UPDATED, bufferController);
                playbackController.subscribe(playbackController.eventList.ENAME_WALLCLOCK_TIME_UPDATED, scheduleController);

                baseUrlExt.subscribe(baseUrlExt.eventList.ENAME_INITIALIZATION_LOADED, indexHandler);
                baseUrlExt.subscribe(baseUrlExt.eventList.ENAME_SEGMENTS_LOADED, indexHandler);
            }

            indexHandler.initialize(this);
            bufferController.initialize(type, buffer, mediaSource, self);
            scheduleController.initialize(type, this);

            fragmentModel = this.getFragmentModel();
            fragmentModel.setLoader(fragmentLoader);
            fragmentModel.subscribe(fragmentModel.eventList.ENAME_FRAGMENT_LOADING_STARTED, fragmentController);
            fragmentModel.subscribe(fragmentModel.eventList.ENAME_FRAGMENT_LOADING_COMPLETED, fragmentController);
            fragmentModel.subscribe(fragmentModel.eventList.ENAME_STREAM_COMPLETED, fragmentController);
            fragmentModel.subscribe(fragmentModel.eventList.ENAME_FRAGMENT_LOADING_FAILED, scheduleController);
            fragmentLoader.subscribe(fragmentLoader.eventList.ENAME_LOADING_COMPLETED, fragmentModel);

            if (type === "video" || type === "audio") {
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_OUTRUN, fragmentModel);
                bufferController.subscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_BALANCED, fragmentModel);
                bufferController.subscribe(bufferController.eventList.ENAME_BYTES_REJECTED, fragmentModel);
            }

            trackController.initialize(this);
        },

        isUpdating: function() {
            return this.trackController.isUpdating();
        },

        getType: function() {
            return type;
        },

        getFragmentModel: function() {
            return this.scheduleController.getFragmentModel();
        },

        getStreamInfo: function() {
            return stream.getStreamInfo();
        },

        setMediaInfo: function(value) {
            mediaInfo = value;
        },

        getMediaInfo: function() {
            return mediaInfo;
        },

        getEventController: function() {
            return eventController;
        },

        start: function() {
            this.scheduleController.start();
        },

        stop: function() {
            this.scheduleController.stop();
        },

        getCurrentTrack: function() {
            return this.adapter.getCurrentTrackInfo(this.trackController);
        },

        getTrackForQuality: function(quality) {
            return this.adapter.getTrackInfoForQuality(this.trackController, quality);
        },

        isBufferingCompleted: function() {
            return this.bufferController.isBufferingCompleted();
        },

        isDynamic: function(){
            return isDynamic;
        },

        reset: function(errored) {
            var self = this,
                bufferController = self.bufferController,
                trackController = self.trackController,
                scheduleController = self.scheduleController,
                liveEdgeFinder = self.liveEdgeFinder,
                fragmentController = self.fragmentController,
                abrController = self.abrController,
                playbackController = self.playbackController,
                indexHandler = this.indexHandler,
                baseUrlExt = this.baseURLExt,
                fragmentModel = this.getFragmentModel(),
                fragmentLoader = this.fragmentLoader,
                videoModel = self.videoModel;

            abrController.unsubscribe(abrController.eventList.ENAME_QUALITY_CHANGED, bufferController);
            abrController.unsubscribe(abrController.eventList.ENAME_QUALITY_CHANGED, trackController);
            abrController.unsubscribe(abrController.eventList.ENAME_QUALITY_CHANGED, scheduleController);

            liveEdgeFinder.unsubscribe(liveEdgeFinder.eventList.ENAME_LIVE_EDGE_FOUND, this.timelineConverter);
            liveEdgeFinder.unsubscribe(liveEdgeFinder.eventList.ENAME_LIVE_EDGE_FOUND, scheduleController);
            liveEdgeFinder.unsubscribe(liveEdgeFinder.eventList.ENAME_LIVE_EDGE_FOUND, trackController);

            trackController.unsubscribe(trackController.eventList.ENAME_DATA_UPDATE_STARTED, scheduleController);
            trackController.unsubscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, bufferController);
            trackController.unsubscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, scheduleController);
            trackController.unsubscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, abrController);
            trackController.unsubscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, stream);
            trackController.unsubscribe(trackController.eventList.ENAME_DATA_UPDATE_COMPLETED, playbackController);

            fragmentController.unsubscribe(fragmentController.eventList.ENAME_INIT_FRAGMENT_LOADED, bufferController);
            fragmentController.unsubscribe(fragmentController.eventList.ENAME_MEDIA_FRAGMENT_LOADED, bufferController);
            fragmentController.unsubscribe(fragmentController.eventList.ENAME_MEDIA_FRAGMENT_LOADING_START, scheduleController);
            fragmentController.unsubscribe(fragmentController.eventList.ENAME_STREAM_COMPLETED, scheduleController);
            fragmentController.unsubscribe(fragmentController.eventList.ENAME_STREAM_COMPLETED, bufferController);
            fragmentController.unsubscribe(fragmentController.eventList.ENAME_STREAM_COMPLETED, scheduleController.scheduleRulesCollection.bufferLevelRule);

            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_STATE_CHANGED, videoModel);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_CLEARED, scheduleController);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BYTES_APPENDED, scheduleController);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BYTES_REJECTED, scheduleController);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_UPDATED, scheduleController);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_UPDATED, trackController);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_STATE_CHANGED, scheduleController);
            bufferController.unsubscribe(bufferController.eventList.ENAME_INIT_REQUESTED, scheduleController);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFERING_COMPLETED, stream);
            bufferController.unsubscribe(bufferController.eventList.ENAME_CLOSED_CAPTIONING_REQUESTED, scheduleController);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_OUTRUN, scheduleController.scheduleRulesCollection.bufferLevelRule);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_BALANCED, scheduleController.scheduleRulesCollection.bufferLevelRule);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BYTES_APPENDED, playbackController);

            playbackController.unsubscribe(playbackController.eventList.ENAME_PLAYBACK_PROGRESS, bufferController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_PLAYBACK_TIME_UPDATED, bufferController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_PLAYBACK_RATE_CHANGED, bufferController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_PLAYBACK_RATE_CHANGED, scheduleController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_PLAYBACK_SEEKING, bufferController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_PLAYBACK_SEEKING, scheduleController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_PLAYBACK_STARTED, scheduleController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_WALLCLOCK_TIME_UPDATED, trackController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_WALLCLOCK_TIME_UPDATED, bufferController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_WALLCLOCK_TIME_UPDATED, scheduleController);
            playbackController.unsubscribe(playbackController.eventList.ENAME_PLAYBACK_SEEKING, scheduleController.scheduleRulesCollection.playbackTimeRule);

            baseUrlExt.unsubscribe(baseUrlExt.eventList.ENAME_INITIALIZATION_LOADED, indexHandler);
            baseUrlExt.unsubscribe(baseUrlExt.eventList.ENAME_SEGMENTS_LOADED, indexHandler);

            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_OUTRUN, fragmentModel);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BUFFER_LEVEL_BALANCED, fragmentModel);
            bufferController.unsubscribe(bufferController.eventList.ENAME_BYTES_REJECTED, fragmentModel);

            fragmentModel.unsubscribe(fragmentModel.eventList.ENAME_FRAGMENT_LOADING_STARTED, fragmentController);
            fragmentModel.unsubscribe(fragmentModel.eventList.ENAME_FRAGMENT_LOADING_COMPLETED, fragmentController);
            fragmentModel.unsubscribe(fragmentModel.eventList.ENAME_STREAM_COMPLETED, fragmentController);
            fragmentModel.unsubscribe(fragmentModel.eventList.ENAME_FRAGMENT_LOADING_FAILED, scheduleController);
            fragmentLoader.unsubscribe(fragmentLoader.eventList.ENAME_LOADING_COMPLETED, fragmentModel);
            fragmentController.resetModel(fragmentModel);

            indexHandler.reset();
            this.bufferController.reset(errored);
            this.scheduleController.reset();
            this.bufferController = null;
            this.scheduleController = null;
            this.trackController = null;
            this.videoModel = null;
            this.fragmentController = null;
        }

    };
};

MediaPlayer.dependencies.StreamProcessor.prototype = {
    constructor: MediaPlayer.dependencies.StreamProcessor
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2014, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.utils.TokenAuthentication = function () {
    "use strict";
    var tokenAuthentication = {type:MediaPlayer.utils.TokenAuthentication.TYPE_QUERY};
    return {
        debug:undefined,
        getTokenAuthentication:function () {

            return tokenAuthentication;

        },
        setTokenAuthentication:function (object) {

            tokenAuthentication = object;

        },
        checkRequestHeaderForToken:function(request) {

            if (tokenAuthentication.name !== undefined &&
                request.getResponseHeader(tokenAuthentication.name) !== null) {

                tokenAuthentication.token = request.getResponseHeader(tokenAuthentication.name);
                this.debug.log(tokenAuthentication.name+" received: " + tokenAuthentication.token);

           }
        },
        addTokenAsQueryArg:function(url) {

            if(tokenAuthentication.name !== undefined && tokenAuthentication.token !== undefined) {
                if (tokenAuthentication.type === MediaPlayer.utils.TokenAuthentication.TYPE_QUERY) {

                    var modifier = url.indexOf('?') === -1 ? '?' : '&';
                    url += modifier + tokenAuthentication.name +"=" + tokenAuthentication.token;
                    this.debug.log(tokenAuthentication.name+" is being appended on the request url with a value of : " + tokenAuthentication.token);

                }
            }

            return url;
        },
        setTokenInRequestHeader:function(request) {

            if (tokenAuthentication.type === MediaPlayer.utils.TokenAuthentication.TYPE_HEADER) {

                request.setRequestHeader(tokenAuthentication.name, tokenAuthentication.token);
                this.debug.log(tokenAuthentication.name+" is being set in the request header with a value of : " + tokenAuthentication.token);

            }

            return request;
        }
    };
};

MediaPlayer.utils.TokenAuthentication.TYPE_QUERY = "query";
MediaPlayer.utils.TokenAuthentication.TYPE_HEADER = "header";;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2014, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.models.URIQueryAndFragmentModel = function () {
    "use strict";

    var URIFragmentDataVO = new MediaPlayer.vo.URIFragmentData(),
        URIQueryData = [],

        parseURI = function (uri) {
            if (!uri) return null;

            var URIFragmentData = [],
                testQuery = new RegExp(/[?]/),
                testFragment = new RegExp(/[#]/),
                isQuery = testQuery.test(uri),
                isFragment = testFragment.test(uri),
                mappedArr;

            function reduceArray(previousValue, currentValue, index, array) {
                var arr =  array[0].split(/[=]/);
                array.push({key:arr[0], value:arr[1]});
                array.shift();
                return array;
            }

            function mapArray(currentValue, index, array) {
                if (index > 0)
                {
                    if (isQuery && URIQueryData.length === 0) {
                        URIQueryData = array[index].split(/[&]/);
                    } else if (isFragment) {
                        URIFragmentData = array[index].split(/[&]/);
                    }
                }

                return array;
            }

            mappedArr = uri.split(/[?#]/).map(mapArray);

            if (URIQueryData.length > 0) {
                URIQueryData = URIQueryData.reduce(reduceArray, null);
            }

            if (URIFragmentData.length > 0) {
                URIFragmentData = URIFragmentData.reduce(reduceArray, null);
                URIFragmentData.forEach(function (object) {
                    URIFragmentDataVO[object.key] = object.value;
                });
            }

            return uri;
        };

    return {
        parseURI:parseURI,
        getURIFragmentData:URIFragmentDataVO,
        getURIQueryData:URIQueryData,

        reset: function() {
            URIFragmentDataVO = new MediaPlayer.vo.URIFragmentData();
            URIQueryData = [];
        }
    };
};

MediaPlayer.models.URIQueryAndFragmentModel.prototype = {
    constructor: MediaPlayer.models.URIQueryAndFragmentModel
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.models.VideoModel = function () {
    "use strict";

    var element,
        stalledStreams = [],
        //_currentTime = 0,

        isStalled = function () {
            return (stalledStreams.length > 0);
        },

        addStalledStream = function (type) {
            if (type === null) {
                return;
            }

            // Halt playback until nothing is stalled.
            element.playbackRate = 0;

            if (stalledStreams[type] === true) {
                return;
            }

            stalledStreams.push(type);
            stalledStreams[type] = true;
        },

        removeStalledStream = function (type) {
            if (type === null) {
                return;
            }

            stalledStreams[type] = false;
            var index = stalledStreams.indexOf(type);
            if (index !== -1) {
                stalledStreams.splice(index, 1);
            }

            // If nothing is stalled resume playback.
            if (isStalled() === false) {
                element.playbackRate = 1;
            }
        },

        stallStream = function (type, isStalled) {
            if (isStalled) {
                addStalledStream(type);
            } else {
                removeStalledStream(type);
            }
        },

        onBufferLevelStateChanged = function(sender, hasSufficientBuffer) {
            var type = sender.streamProcessor.getType();

            stallStream.call(this, type, !hasSufficientBuffer);
        }
        /*,
        handleSetCurrentTimeNotification = function () {
            if (element.currentTime !== _currentTime) {
                element.currentTime = _currentTime;
            }
        }*/;

    return {
        system : undefined,

        setup : function () {
            this.bufferLevelStateChanged = onBufferLevelStateChanged;
            //this.system.mapHandler("setCurrentTime", undefined, handleSetCurrentTimeNotification.bind(this));
        },

        play: function () {
            element.play();
        },

        pause: function () {
            element.pause();
        },

        isPaused: function () {
            return element.paused;
        },

        getPlaybackRate:  function () {
            return element.playbackRate;
        },

        setPlaybackRate: function (value) {
            element.playbackRate = value;
        },

        getCurrentTime: function () {
            return element.currentTime;
        },

        setCurrentTime: function (currentTime) {
            //_currentTime = currentTime;

            // We don't set the same currentTime because it can cause firing unexpected Pause event in IE11
            // providing playbackRate property equals to zero.
            if (element.currentTime == currentTime) return;

            element.currentTime = currentTime;
        },

        listen: function (type, callback) {
            element.addEventListener(type, callback, false);
        },

        unlisten: function (type, callback) {
            element.removeEventListener(type, callback, false);
        },

        getElement: function () {
            return element;
        },

        setElement: function (value) {
            element = value;
        },

        setSource: function (source) {
            element.src = source;
        }
    };
};

MediaPlayer.models.VideoModel.prototype = {
    constructor: MediaPlayer.models.VideoModel
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.VideoModelExtensions = function () {
    "use strict";

    return {
        getPlaybackQuality: function (videoElement) {
            var hasWebKit = ("webkitDroppedFrameCount" in videoElement),
                hasQuality = ("getVideoPlaybackQuality" in videoElement),
                result = null;

            if (hasQuality) {
                result = videoElement.getVideoPlaybackQuality();
            }
            else if (hasWebKit) {
                result = {droppedVideoFrames: videoElement.webkitDroppedFrameCount, creationTime: new Date()};
            }

            return result;
        }
    };
};

MediaPlayer.dependencies.VideoModelExtensions.prototype = {
    constructor: MediaPlayer.dependencies.VideoModelExtensions
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Akamai Technologies nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.utils.TTMLParser = function () {
    "use strict";

    /*
    * This TTML parser follows "TTML Simple Delivery Profile for Closed Captions (US)" spec - http://www.w3.org/TR/ttml10-sdp-us/
    * */

    var SECONDS_IN_HOUR = 60 * 60,
        SECONDS_IN_MIN = 60,
        // R0028 - A document must not contain a <timeExpression> value that does not conform to the subset of clock-time that
        // matches either of the following patterns: hh:mm:ss.mss or hh:mm:ss:ff, where hh denotes hours (00-23),
        // mm denotes minutes (00-59), ss denotes seconds (00-59), mss denotes milliseconds (000-999), and ff denotes frames (00-frameRate - 1).
        // R0030 - For time expressions that use the hh:mm:ss.mss format, the following constraints apply:
        // - Exactly 2 digits must be used in each of the hours, minutes, and second components (include leading zeros).
        // - Exactly 3 decimal places must be used for the milliseconds component (include leading zeros).
        // R0031 -For time expressions that use the hh:mm:ss:ff format, the following constraints apply:
        // - Exactly 2 digits must be used in each of the hours, minutes, second, and frame components (include leading zeros).
        timingRegex = /^(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])((\.[0-9][0-9][0-9])|(:[0-9][0-9]))$/,
        ttml,

        parseTimings = function(timingStr) {
            var test = timingRegex.test(timingStr),
                timeParts,
                parsedTime,
                frameRate;

            if (!test) {
                return NaN;
            }

            timeParts = timingStr.split(":");

            parsedTime = (parseFloat(timeParts[0]) * SECONDS_IN_HOUR +
                parseFloat(timeParts[1]) * SECONDS_IN_MIN +
                parseFloat(timeParts[2]));

            // R0031 -For time expressions that use the hh:mm:ss:ff format, the following constraints apply:
            //  - A ttp:frameRate attribute must be present on the tt element.
            //  - A ttp:frameRateMultiplier attribute may be present on the tt element.
            if (timeParts[3]) {
                frameRate = ttml.tt.frameRate;

                if (frameRate && !isNaN(frameRate)) {
                    parsedTime += parseFloat(timeParts[3]) / frameRate;
                } else {
                    return NaN;
                }
            }

            return parsedTime;
        },

        passStructuralConstraints = function () {
            var passed = false,
                hasTt = ttml.hasOwnProperty("tt"),
                hasHead = hasTt ? ttml.tt.hasOwnProperty("head") : false,
                hasLayout = hasHead ? ttml.tt.head.hasOwnProperty("layout") : false,
                hasStyling = hasHead ? ttml.tt.head.hasOwnProperty("styling") : false,
                hasBody = hasTt ? ttml.tt.hasOwnProperty("body") : false,
                hasProfile = hasHead ? ttml.tt.head.hasOwnProperty("profile") : false;

            // R001 - A document must contain a tt element.
            // R002 - A document must contain both a head and body element.
            // R003 - A document must contain both a styling and a layout element.
            if (hasTt && hasHead && hasLayout && hasStyling && hasBody) {
                passed = true;
            }

            // R0008 - A document must contain a ttp:profile element where the use attribute of that element is specified as http://www.w3.org/ns/ttml/profile/sdp-us.
            if (passed) {
                passed = hasProfile && (ttml.tt.head.profile.use === "http://www.w3.org/ns/ttml/profile/sdp-us");
            }

            return passed;
        },

        getNamespacePrefix = function(json, ns) {
            var r = Object.keys(json)
                .filter(function(k){
                    return k.split(":")[0] === "xmlns" && json[k] === ns;
                }).map(function(k){
                    return k.split(":")[1];
                });
            if (r.length != 1) {
                return null;
            }
            return r[0];
        },

        internalParse = function(data) {
            var captionArray = [],
                converter = new X2JS([], "", false),
                errorMsg,
                cues,
                cue,
                startTime,
                endTime,
                nsttp,
                i;

            ttml = converter.xml_str2json(data);

            if (!passStructuralConstraints()) {
                errorMsg = "TTML document has incorrect structure";
                throw errorMsg;
            }

            nsttp = getNamespacePrefix(ttml.tt, "http://www.w3.org/ns/ttml#parameter");

            if (ttml.tt.hasOwnProperty(nsttp + ":frameRate")) {
                ttml.tt.frameRate = parseInt(ttml.tt[nsttp + ":frameRate"], 10);
            }

            cues = ttml.tt.body.div_asArray[0].p_asArray;

            if (!cues || cues.length === 0) {
                errorMsg = "TTML document does not contain any cues";
                throw errorMsg;
            }

            for (i = 0; i < cues.length; i += 1) {
                cue = cues[i];
                startTime = parseTimings(cue.begin);
                endTime = parseTimings(cue.end);

                if (isNaN(startTime) || isNaN(endTime)) {
                    errorMsg = "TTML document has incorrect timing value";
                    throw errorMsg;
                }

                captionArray.push({
                    start: startTime,
                    end: endTime,
                    data: cue.__text
                });
            }

            return captionArray;
    };

    return {
        parse: internalParse
    };
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Akamai Technologies nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.TextController = function () {

     var initialized = false,
         mediaSource,
         buffer,
         type,

         onDataUpdateCompleted = function(/*sender ,data, trackData*/) {
             if (!initialized) {
                 if (buffer.hasOwnProperty('initialize')) {
                     buffer.initialize(type, this);
                 }
                 initialized = true;
             }
             this.notify(this.eventList.ENAME_CLOSED_CAPTIONING_REQUESTED, 0);
         },

         onInitFragmentLoaded = function (sender, model, bytes/*, quality*/) {
             var self = this;

             if (model !== self.streamProcessor.getFragmentModel()) return;

             if (bytes !== null) {
                 //self.debug.log("Push text track bytes: " + data.byteLength);
                 self.sourceBufferExt.append(buffer, bytes, self.videoModel);
             }
         };

    return {
        sourceBufferExt: undefined,
        debug: undefined,
        system: undefined,
        notify: undefined,
        subscribe: undefined,
        unsubscribe: undefined,
        eventList: {
            ENAME_CLOSED_CAPTIONING_REQUESTED: "closedCaptioningRequested"
        },

        setup: function() {
            this.dataUpdateCompleted = onDataUpdateCompleted;
            this.initFragmentLoaded = onInitFragmentLoaded;
        },

        initialize: function (typeValue, buffer, source, streamProcessor) {
            var self = this;

            type = typeValue;
            self.setBuffer(buffer);
            self.setMediaSource(source);
            self.videoModel = streamProcessor.videoModel;
            self.trackController = streamProcessor.trackController;
            self.streamProcessor = streamProcessor;
        },

        getBuffer: function () {
            return buffer;
        },

        setBuffer: function (value) {
            buffer = value;
        },

        setMediaSource: function(value) {
            mediaSource = value;
        },

        reset: function (errored) {
            if (!errored) {
                this.sourceBufferExt.abort(mediaSource, buffer);
                this.sourceBufferExt.removeSourceBuffer(mediaSource, buffer);
            }
        }
    };
};

MediaPlayer.dependencies.TextController.prototype = {
    constructor: MediaPlayer.dependencies.TextController
};

;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Akamai Technologies nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.dependencies.TextSourceBuffer = function () {

    var mediaInfo,
        mimeType;

    return {
        system:undefined,
        eventBus:undefined,
        errHandler: undefined,

        initialize: function (type, bufferController) {
            mimeType = type;
            this.videoModel = bufferController.videoModel;
            mediaInfo = bufferController.streamProcessor.getCurrentTrack().mediaInfo;
        },

        append: function (bytes) {
            var self = this,
                result,
                label,
                lang,
                ccContent = String.fromCharCode.apply(null, new Uint16Array(bytes));

            try {
                result = self.getParser().parse(ccContent);
                label = mediaInfo.id;
                lang = mediaInfo.lang;

                self.getTextTrackExtensions().addTextTrack(self.videoModel.getElement(), result, label, lang, true);
                self.eventBus.dispatchEvent({type:"updateend"});
            } catch(e) {
                self.errHandler.closedCaptionsError(e, "parse", ccContent);
            }
        },

        abort:function() {
            this.getTextTrackExtensions().deleteCues(this.videoModel.getElement());
        },

        getParser:function() {
            var parser;

            if (mimeType === "text/vtt") {
                parser = this.system.getObject("vttParser");
            } else if (mimeType === "application/ttml+xml") {
                parser = this.system.getObject("ttmlParser");
            }

            return parser;
        },

        getTextTrackExtensions:function() {
            return this.system.getObject("textTrackExtensions");
        },

        addEventListener: function (type, listener, useCapture) {
            this.eventBus.addEventListener(type, listener, useCapture);
        },

        removeEventListener: function (type, listener, useCapture) {
            this.eventBus.removeEventListener(type, listener, useCapture);
        }
    };
};

MediaPlayer.dependencies.TextSourceBuffer.prototype = {
    constructor: MediaPlayer.dependencies.TextSourceBuffer
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Akamai Technologies nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.utils.TextTrackExtensions = function () {
    "use strict";
    var Cue;

    return {
        setup: function() {
            Cue = window.VTTCue || window.TextTrackCue;
        },

        addTextTrack: function(video, captionData,  label, scrlang, isDefaultTrack) {

            //TODO: Ability to define the KIND in the MPD - ie subtitle vs caption....
            var track = video.addTextTrack("captions", label, scrlang);
            // track.default is an object property identifier that is a reserved word
            // The following jshint directive is used to suppressed the warning "Expected an identifier and instead saw 'default' (a reserved word)"
            /*jshint -W024 */
            track.default = isDefaultTrack;
            track.mode = "showing";

            for(var item in captionData) {
                var currentItem = captionData[item];
                track.addCue(new Cue(currentItem.start, currentItem.end, currentItem.data));
            }

            return track;
        },
        deleteCues: function(video) {
            //when multiple tracks are supported - iterate through and delete all cues from all tracks.

            var i = 0,
                firstValidTrack = false;

            while (!firstValidTrack)
            {
                if (video.textTracks[i].cues !== null)
                {
                    firstValidTrack = true;
                    break;
                }
                i++;
            }

            var track = video.textTracks[i],
                cues = track.cues,
                lastIdx = cues.length - 1;

            for (i = lastIdx; i >= 0 ; i--) {
                track.removeCue(cues[i]);
            }

            track.mode = "disabled";
            // The following jshint directive is used to suppressed the warning "Expected an identifier and instead saw 'default' (a reserved word)"
            /*jshint -W024 */
            track.default = false;
        }

    };
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Akamai Technologies nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.utils.VTTParser = function () {
    "use strict";

    var convertCuePointTimes = function(time) {
        var timeArray = time.split( ":"),
            len = timeArray.length - 1;

        time = parseInt( timeArray[len-1], 10 ) * 60 + parseFloat( timeArray[len], 10 );

        if ( len === 2 ) {
            time += parseInt( timeArray[0], 10 ) * 3600;
        }

        return time;
    };

    return {

        parse: function (data)
        {
            var regExNewLine = /(?:\r\n|\r|\n)/gm,
                regExToken = /-->/,
                regExWhiteSpace = /(^[\s]+|[\s]+$)/g,
                captionArray = [],
                len;

            data = data.split( regExNewLine );
            len = data.length;

            for (var i = 0 ; i < len; i++)
            {
                var item = data[i];

                if (item.length > 0 && item !== "WEBVTT")
                {
                    if (item.match(regExToken))
                    {
                        var cuePoints = item.split(regExToken);
                        //vtt has sublines so more will need to be done here
                        var sublines = data[i+1];

                        //TODO Make VO external so other parsers can use.
                        captionArray.push({
                            start:convertCuePointTimes(cuePoints[0].replace(regExWhiteSpace, '')),
                            end:convertCuePointTimes(cuePoints[1].replace(regExWhiteSpace, '')),
                            data:sublines
                        });
                    }
                }
            }

            return captionArray;
        }
    };
};
;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.rules.ABRRulesCollection = function () {
    "use strict";

    var qualitySwitchRules = [];

    return {
        downloadRatioRule: undefined,
        insufficientBufferRule: undefined,
        limitSwitchesRule: undefined,

        getRules: function (type) {
            switch (type) {
                case MediaPlayer.rules.ABRRulesCollection.prototype.QUALITY_SWITCH_RULES:
                    return qualitySwitchRules;
                default:
                    return null;
            }
        },

        setup: function () {
            qualitySwitchRules.push(this.downloadRatioRule);
            qualitySwitchRules.push(this.insufficientBufferRule);
            qualitySwitchRules.push(this.limitSwitchesRule);
        }
    };
};

MediaPlayer.rules.ABRRulesCollection.prototype = {
    constructor: MediaPlayer.rules.ABRRulesCollection,
    QUALITY_SWITCH_RULES: "qualitySwitchRules"
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.rules.DownloadRatioRule = function () {
    "use strict";

    /*
     * This rule is intended to be sure that we can download fragments in a
     * timely manner.  The general idea is that it should take longer to download
     * a fragment than it will take to play the fragment.
     *
     * This rule is not sufficient by itself.  We may be able to download a fragment
     * fine, but if the buffer is not sufficiently long playback hiccups will happen.
     * Be sure to use this rule in conjuction with the InsufficientBufferRule.
     */

    var streamProcessors = {},

        checkRatio = function (sp, newIdx, currentBandwidth) {
            var newBandwidth = sp.getTrackForQuality(newIdx).bandwidth;

            return (newBandwidth / currentBandwidth);
        };

    return {
        debug: undefined,
        metricsExt: undefined,
        metricsModel: undefined,

        setStreamProcessor: function(streamProcessorValue) {
            var type = streamProcessorValue.getType(),
                id = streamProcessorValue.getStreamInfo().id;

            streamProcessors[id] = streamProcessors[id] || {};
            streamProcessors[id][type] = streamProcessorValue;
        },

        execute: function (context, callback) {
            var self = this,
                streamId = context.getStreamInfo().id,
                mediaInfo = context.getMediaInfo(),
                mediaType = mediaInfo.type,
                current = context.getCurrentValue(),
                sp = streamProcessors[streamId][mediaType],
                metrics = self.metricsModel.getReadOnlyMetricsFor(mediaType),
                lastRequest = self.metricsExt.getCurrentHttpRequest(metrics),
                downloadTime,
                totalTime,
                downloadRatio,
                totalRatio,
                switchRatio,
                oneDownBandwidth,
                oneUpBandwidth,
                currentBandwidth,
                i,
                max,
                switchRequest,
                DOWNLOAD_RATIO_SAFETY_FACTOR = 0.75;

            //self.debug.log("Checking download ratio rule...");

            if (!metrics) {
                //self.debug.log("No metrics, bailing.");
                callback(new MediaPlayer.rules.SwitchRequest());
                return;
            }

            if (lastRequest === null) {
                //self.debug.log("No requests made for this stream yet, bailing.");
                callback(new MediaPlayer.rules.SwitchRequest());
                return;
            }

            totalTime = (lastRequest.tfinish.getTime() - lastRequest.trequest.getTime()) / 1000;
            downloadTime = (lastRequest.tfinish.getTime() - lastRequest.tresponse.getTime()) / 1000;

            if (totalTime <= 0) {
                //self.debug.log("Don't know how long the download of the last fragment took, bailing.");
                callback(new MediaPlayer.rules.SwitchRequest());
                return;
            }

            if (lastRequest.mediaduration === null ||
                lastRequest.mediaduration === undefined ||
                lastRequest.mediaduration <= 0 ||
                isNaN(lastRequest.mediaduration)) {
                //self.debug.log("Don't know the duration of the last media fragment, bailing.");
                callback(new MediaPlayer.rules.SwitchRequest());
                return;
            }

            // TODO : I structured this all goofy and messy.  fix plz

            totalRatio = lastRequest.mediaduration / totalTime;
            downloadRatio = (lastRequest.mediaduration / downloadTime) * DOWNLOAD_RATIO_SAFETY_FACTOR;

            if (isNaN(downloadRatio) || isNaN(totalRatio)) {
                //self.debug.log("Total time: " + totalTime + "s");
                //self.debug.log("Download time: " + downloadTime + "s");
                self.debug.log("The ratios are NaN, bailing.");
                callback(new MediaPlayer.rules.SwitchRequest());
                return;
            }

            //self.debug.log("Total ratio: " + totalRatio);
            //self.debug.log("Download ratio: " + downloadRatio);

            if (isNaN(downloadRatio)) {
                //self.debug.log("Invalid ratio, bailing.");
                switchRequest = new MediaPlayer.rules.SwitchRequest();
            } else if (downloadRatio < 4.0) {
                //self.debug.log("Download ratio is poor.");
                if (current > 0) {
                    self.debug.log("We are not at the lowest bitrate, so switch down.");
                    oneDownBandwidth = sp.getTrackForQuality(current - 1).bandwidth;
                    currentBandwidth = sp.getTrackForQuality(current).bandwidth;
                    switchRatio = oneDownBandwidth / currentBandwidth;
                    //self.debug.log("Switch ratio: " + switchRatio);

                    if (downloadRatio < switchRatio) {
                        self.debug.log("Things must be going pretty bad, switch all the way down.");
                        switchRequest = new MediaPlayer.rules.SwitchRequest(0);
                    } else {
                        self.debug.log("Things could be better, so just switch down one index.");
                        switchRequest = new MediaPlayer.rules.SwitchRequest(current - 1);
                    }
                } else {
                    //self.debug.log("We are at the lowest bitrate and cannot switch down, use current.");
                    switchRequest = new MediaPlayer.rules.SwitchRequest(current);
                }
            } else {
                //self.debug.log("Download ratio is good.");
                max = mediaInfo.trackCount - 1; // 0 based

                if (current < max) {
                    //self.debug.log("We are not at the highest bitrate, so switch up.");
                    oneUpBandwidth = sp.getTrackForQuality(current + 1).bandwidth;
                    currentBandwidth = sp.getTrackForQuality(current).bandwidth;
                    switchRatio = oneUpBandwidth / currentBandwidth;
                    //self.debug.log("Switch ratio: " + switchRatio);

                    if (downloadRatio >= switchRatio) {
                        if (downloadRatio > 100.0) {
                            self.debug.log("Tons of bandwidth available, go all the way up.");
                            switchRequest = new MediaPlayer.rules.SwitchRequest(max);
                        }
                        else if (downloadRatio > 10.0) {
                            self.debug.log("Just enough bandwidth available, switch up one.");
                            switchRequest = new MediaPlayer.rules.SwitchRequest(current + 1);
                        }
                        else {
                            //self.debug.log("Not exactly sure where to go, so do some math.");
                            i = -1;
                            while ((i += 1) < max) {
                                if (downloadRatio < checkRatio.call(self, sp, i, currentBandwidth)) {
                                    break;
                                }
                            }

                            self.debug.log("Calculated ideal new quality index is: " + i);
                            switchRequest = new MediaPlayer.rules.SwitchRequest(i);
                        }
                    } else {
                        //self.debug.log("Not enough bandwidth to switch up.");
                        switchRequest = new MediaPlayer.rules.SwitchRequest();
                    }
                } else {
                    //self.debug.log("We are at the highest bitrate and cannot switch up, use current.");
                    switchRequest = new MediaPlayer.rules.SwitchRequest(max);
                }
            }

            callback(switchRequest);
        },

        reset: function() {
            streamProcessors = {};
        }
    };
};

MediaPlayer.rules.DownloadRatioRule.prototype = {
    constructor: MediaPlayer.rules.DownloadRatioRule
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.rules.InsufficientBufferRule = function () {
    "use strict";

    /*
     * This rule is intended to be sure that our buffer doesn't run dry.
     * If the buffer runs dry playback halts until more data is downloaded.
     * The buffer will run dry when the fragments are taking too long to download.
     * The player may have sufficient bandwidth to download a fragment is a reasonable time,
     * but the play may not leave enough time in the buffer to allow for longer fragments.
     * A dry buffer is a good indication of this use case, so we want to switch down to
     * smaller fragments to decrease download time.
     *
     * TODO
     * An alternative would be to increase the size of the buffer.
     * Is there a good way to handle this?
     * Maybe the BufferExtensions should have some monitoring built into the
     * shouldBufferMore method to increase the buffer over time...
     */

    var dryBufferHits = 0,
        DRY_BUFFER_LIMIT = 3;

    return {
        debug: undefined,
        metricsModel: undefined,

        execute: function (context, callback) {
            var self = this,
                mediaType = context.getMediaInfo().type,
                current = context.getCurrentValue(),
                metrics = self.metricsModel.getReadOnlyMetricsFor(mediaType),
                playlist,
                trace,
                shift = false,
                p = MediaPlayer.rules.SwitchRequest.prototype.DEFAULT;

            //self.debug.log("Checking insufficient buffer rule...");

            if (metrics.PlayList === null || metrics.PlayList === undefined || metrics.PlayList.length === 0) {
                //self.debug.log("Not enough information for rule.");
                callback(new MediaPlayer.rules.SwitchRequest());
                return;
            }

            playlist = metrics.PlayList[metrics.PlayList.length - 1];

            if (playlist === null || playlist === undefined || playlist.trace.length === 0) {
                //self.debug.log("Not enough information for rule.");
                callback(new MediaPlayer.rules.SwitchRequest());
                return;
            }

            // The last trace is the currently playing fragment.
            // So get the trace *before* that one.
            trace = playlist.trace[playlist.trace.length - 2];

            if (trace === null || trace === undefined || trace.stopreason === null || trace.stopreason === undefined) {
                //self.debug.log("Not enough information for rule.");
                callback(new MediaPlayer.rules.SwitchRequest());
                return;
            }

            if (trace.stopreason === MediaPlayer.vo.metrics.PlayList.Trace.REBUFFERING_REASON) {
                shift = true;
                dryBufferHits += 1;
                self.debug.log("Number of times the buffer has run dry: " + dryBufferHits);
            }

            // if we've hit a dry buffer too many times, become strong to override whatever is
            // causing the stream to switch up
            if (dryBufferHits > DRY_BUFFER_LIMIT) {
                p = MediaPlayer.rules.SwitchRequest.prototype.STRONG;
                self.debug.log("Apply STRONG to buffer rule.");
            }

            if (shift) {
                self.debug.log("The buffer ran dry recently, switch down.");
                callback(new MediaPlayer.rules.SwitchRequest(current - 1, p));
            } else if (dryBufferHits > DRY_BUFFER_LIMIT) {
                self.debug.log("Too many dry buffer hits, quit switching bitrates.");
                callback(new MediaPlayer.rules.SwitchRequest(current, p));
            } else {
                callback(new MediaPlayer.rules.SwitchRequest(MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE, p));
            }
        }
    };
};

MediaPlayer.rules.InsufficientBufferRule.prototype = {
    constructor: MediaPlayer.rules.InsufficientBufferRule
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.rules.LimitSwitchesRule = function () {
    "use strict";

    /*
     * This rule is intended to limit the number of switches that can happen.
     * We might get into a situation where there quality is bouncing around a ton.
     * This can create an unpleasant experience, so let the stream settle down.
     */
    var lastCheckTime = 0,
        qualitySwitchThreshold = 2000;

    return {
        debug: undefined,
        metricsModel: undefined,

        execute: function (context, callback) {
            var self = this,
                mediaType = context.getMediaInfo().type,
                current = context.getCurrentValue(),
                metrics = this.metricsModel.getReadOnlyMetricsFor(mediaType),
                manifestInfo = context.getManifestInfo(),
                lastIdx = metrics.RepSwitchList.length - 1,
                rs = metrics.RepSwitchList[lastIdx],
                now = new Date().getTime(),
                delay;

            //self.debug.log("Checking limit switches rule...");
            qualitySwitchThreshold = Math.min(manifestInfo.minBufferTime, manifestInfo.maxFragmentDuration) * 1000;

            delay = now - lastCheckTime;

            if (delay < qualitySwitchThreshold && (now - rs.t.getTime()) < qualitySwitchThreshold) {
                self.debug.log("Wait some time before allowing another switch.");
                callback(new MediaPlayer.rules.SwitchRequest(current, MediaPlayer.rules.SwitchRequest.prototype.STRONG));
                return;
            }

            lastCheckTime = now;

            callback(new MediaPlayer.rules.SwitchRequest(MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE, MediaPlayer.rules.SwitchRequest.prototype.STRONG));
        }
    };
};

MediaPlayer.rules.LimitSwitchesRule.prototype = {
    constructor: MediaPlayer.rules.LimitSwitchesRule
};;MediaPlayer.rules.RulesContext = function (streamProcessor, currentValue) {
    "use strict";
    var trackInfo = streamProcessor.getCurrentTrack();

    return {
        getStreamInfo: function() {
            return trackInfo.mediaInfo.streamInfo;
        },

        getMediaInfo: function() {
            return trackInfo.mediaInfo;
        },

        getTrackInfo: function() {
            return trackInfo;
        },

        getCurrentValue: function() {
            return currentValue;
        },

        getManifestInfo: function() {
            return trackInfo.mediaInfo.streamInfo.manifestInfo;
        }
    };
};

MediaPlayer.rules.RulesContext.prototype = {
    constructor: MediaPlayer.rules.RulesContext
};;MediaPlayer.rules.BufferLevelRule = function () {
    "use strict";

    var isBufferLevelOutran = {},
        isCompleted = {},
        scheduleController = {},

        getCurrentHttpRequestLatency = function(metrics) {
            var httpRequest = this.metricsExt.getCurrentHttpRequest(metrics);
            if (httpRequest !== null) {
                return (httpRequest.tresponse.getTime() - httpRequest.trequest.getTime()) / 1000;
            }
            return 0;
        },

        decideBufferLength = function (minBufferTime, duration) {
            var minBufferTarget;

            if (isNaN(duration) || MediaPlayer.dependencies.BufferController.DEFAULT_MIN_BUFFER_TIME < duration && minBufferTime < duration) {
                minBufferTarget = Math.max(MediaPlayer.dependencies.BufferController.DEFAULT_MIN_BUFFER_TIME, minBufferTime);
            } else if (minBufferTime >= duration) {
                minBufferTarget = Math.min(duration, MediaPlayer.dependencies.BufferController.DEFAULT_MIN_BUFFER_TIME);
            } else {
                minBufferTarget = Math.min(duration, minBufferTime);
            }

            return minBufferTarget;
        },

        getRequiredBufferLength = function (isDynamic, duration, scheduleController) {
            var self = this,
                criticalBufferLevel = scheduleController.bufferController.getCriticalBufferLevel(),
                minBufferTarget = decideBufferLength.call(this, scheduleController.bufferController.getMinBufferTime(), duration),
                currentBufferTarget = minBufferTarget,
                bufferMax = scheduleController.bufferController.bufferMax,
                vmetrics = self.metricsModel.getReadOnlyMetricsFor("video"),
                ametrics = self.metricsModel.getReadOnlyMetricsFor("audio"),
                isLongFormContent = (duration >= MediaPlayer.dependencies.BufferController.LONG_FORM_CONTENT_DURATION_THRESHOLD),
                requiredBufferLength = 0;

            if (bufferMax === MediaPlayer.dependencies.BufferController.BUFFER_SIZE_MIN) {
                requiredBufferLength = minBufferTarget;
            } else if (bufferMax === MediaPlayer.dependencies.BufferController.BUFFER_SIZE_INFINITY) {
                requiredBufferLength = duration;
            } else if (bufferMax === MediaPlayer.dependencies.BufferController.BUFFER_SIZE_REQUIRED) {
                if (!isDynamic && self.abrController.isPlayingAtTopQuality(scheduleController.streamProcessor.getStreamInfo())) {
                    currentBufferTarget = isLongFormContent ?
                        MediaPlayer.dependencies.BufferController.BUFFER_TIME_AT_TOP_QUALITY_LONG_FORM :
                        MediaPlayer.dependencies.BufferController.BUFFER_TIME_AT_TOP_QUALITY;
                }

                requiredBufferLength = currentBufferTarget + Math.max(getCurrentHttpRequestLatency.call(self, vmetrics),
                    getCurrentHttpRequestLatency.call(self, ametrics));
            }

            requiredBufferLength = Math.min(requiredBufferLength, criticalBufferLevel);

            return requiredBufferLength;
        },

        isCompletedT = function(streamId, type) {
            return (isCompleted[streamId] && isCompleted[streamId][type]);
        },

        isBufferLevelOutranT = function(streamId, type) {
            return (isBufferLevelOutran[streamId] && isBufferLevelOutran[streamId][type]);
        },

        onStreamCompleted = function(sender, model , request) {
            var streamId = model.getContext().streamProcessor.getStreamInfo().id;
            isCompleted[streamId] = isCompleted[streamId] || {};
            isCompleted[streamId][request.mediaType] = true;
        },

        onBufferLevelOutrun = function(sender) {
            var streamId = sender.streamProcessor.getStreamInfo().id;
            isBufferLevelOutran[streamId] = isBufferLevelOutran[streamId] || {};
            isBufferLevelOutran[streamId][sender.streamProcessor.getType()] = true;
        },

        onBufferLevelBalanced = function(sender) {
            var streamId = sender.streamProcessor.getStreamInfo().id;
            isBufferLevelOutran[streamId] = isBufferLevelOutran[streamId] || {};
            isBufferLevelOutran[streamId][sender.streamProcessor.getType()] = false;
        };

    return {
        metricsExt: undefined,
        metricsModel: undefined,
        abrController: undefined,

        setup: function() {
            this.bufferLevelOutrun = onBufferLevelOutrun;
            this.bufferLevelBalanced = onBufferLevelBalanced;
            this.streamCompleted = onStreamCompleted;
        },

        setScheduleController: function(scheduleControllerValue) {
            var id = scheduleControllerValue.streamProcessor.getStreamInfo().id;
            scheduleController[id] = scheduleController[id] || {};
            scheduleController[id][scheduleControllerValue.streamProcessor.getType()] = scheduleControllerValue;
        },

        execute: function(context, callback) {
            var streamInfo = context.getStreamInfo(),
                streamId = streamInfo.id,
                mediaType = context.getMediaInfo().type;

            if (isBufferLevelOutranT(streamId, mediaType)) {
                callback(new MediaPlayer.rules.SwitchRequest(0, MediaPlayer.rules.SwitchRequest.prototype.STRONG));
                return;
            }

            var metrics = this.metricsModel.getReadOnlyMetricsFor(mediaType),
                bufferLevel = this.metricsExt.getCurrentBufferLevel(metrics) ? this.metricsExt.getCurrentBufferLevel(metrics).level : 0,
                scheduleCtrl = scheduleController[streamId][mediaType],
                track = scheduleCtrl.streamProcessor.getCurrentTrack(),
                isDynamic = scheduleCtrl.streamProcessor.isDynamic(),
                rate = this.metricsExt.getCurrentPlaybackRate(metrics),
                duration = streamInfo.duration,
                bufferedDuration = bufferLevel / Math.max(rate, 1),
                fragmentDuration = track.fragmentDuration,
                currentTime = scheduleCtrl.playbackController.getTime(),
                timeToEnd = isDynamic ? Number.POSITIVE_INFINITY : duration - currentTime,
                requiredBufferLength = Math.min(getRequiredBufferLength.call(this, isDynamic, duration, scheduleCtrl), timeToEnd),
                remainingDuration = Math.max(requiredBufferLength - bufferedDuration, 0),
                fragmentCount;

            fragmentCount = Math.ceil(remainingDuration/fragmentDuration);

            if (bufferedDuration >= timeToEnd  && !isCompletedT(streamId,mediaType)) {
                fragmentCount = fragmentCount || 1;
            }

            callback(new MediaPlayer.rules.SwitchRequest(fragmentCount, MediaPlayer.rules.SwitchRequest.prototype.DEFAULT));
        },

        reset: function() {
            isBufferLevelOutran = {};
            isCompleted = {};
            scheduleController = {};
        }
    };
};

MediaPlayer.rules.BufferLevelRule.prototype = {
    constructor: MediaPlayer.rules.BufferLevelRule
};;MediaPlayer.rules.LiveEdgeBinarySearchRule = function () {
    "use strict";

    var SEARCH_TIME_SPAN = 12 * 60 * 60, // set the time span that limits our search range to a 12 hours in seconds
        liveEdgeInitialSearchPosition = NaN,
        liveEdgeSearchRange = null,
        liveEdgeSearchStep = NaN,
        trackInfo = null,
        useBinarySearch = false,
        fragmentDuration = NaN,
        p = MediaPlayer.rules.SwitchRequest.prototype.DEFAULT,
        finder,
        callback,

        findLiveEdge = function (searchTime, onSuccess, onError, request) {
            var self = this,
                req;
            if (request === null) {
                // request can be null because it is out of the generated list of request. In this case we need to
                // update the list and the DVRWindow
                // try to get request object again
                req = self.adapter.generateFragmentRequestForTime(finder.streamProcessor, trackInfo, searchTime);
                findLiveEdge.call(self, searchTime, onSuccess, onError, req);
            } else {
                var handler = function(sender, isExist, request) {
                    finder.fragmentLoader.unsubscribe(finder.fragmentLoader.eventList.ENAME_CHECK_FOR_EXISTENCE_COMPLETED, self, handler);
                    if (isExist) {
                        onSuccess.call(self, request, searchTime);
                    } else {
                        onError.call(self, request, searchTime);
                    }
                };

                finder.fragmentLoader.subscribe(finder.fragmentLoader.eventList.ENAME_CHECK_FOR_EXISTENCE_COMPLETED, self, handler);
                finder.fragmentLoader.checkForExistence(request);
            }
        },

        onSearchForFragmentFailed = function(request, lastSearchTime) {
            var searchTime,
                req,
                searchInterval;

            if (useBinarySearch) {
                binarySearch.call(this, false, lastSearchTime);
                return;
            }

            // we have not found any available fragments yet, update the search interval
            searchInterval = lastSearchTime - liveEdgeInitialSearchPosition;
            // we search forward and backward from the start position, increasing the search interval by the value of the half of the availability interavl - liveEdgeSearchStep
            searchTime = searchInterval > 0 ? (liveEdgeInitialSearchPosition - searchInterval) : (liveEdgeInitialSearchPosition + Math.abs(searchInterval) + liveEdgeSearchStep);

            // if the search time is out of the range bounds we have not be able to find live edge, stop trying
            if (searchTime < liveEdgeSearchRange.start && searchTime > liveEdgeSearchRange.end) {
                callback(new MediaPlayer.rules.SwitchRequest(null, p));
            } else {
                // continue searching for a first available fragment
                req = this.adapter.getFragmentRequestForTime(finder.streamProcessor, trackInfo, searchTime);
                findLiveEdge.call(this, searchTime, onSearchForFragmentSucceeded, onSearchForFragmentFailed, req);
            }
        },

        onSearchForFragmentSucceeded = function (request, lastSearchTime) {
            var startTime = request.startTime,
                self = this,
                req,
                searchTime;

            if (!useBinarySearch) {
                // if the fragment duration is unknown we cannot use binary search because we will not be able to
                // decide when to stop the search, so let the start time of the current fragment be a liveEdge
                if (!trackInfo.fragmentDuration) {
                    callback(new MediaPlayer.rules.SwitchRequest(startTime, p));
                    return;
                }
                useBinarySearch = true;
                liveEdgeSearchRange.end = startTime + (2 * liveEdgeSearchStep);

                //if the first request has succeeded we should check next fragment - if it does not exist we have found live edge,
                // otherwise start binary search to find live edge
                if (lastSearchTime === liveEdgeInitialSearchPosition) {
                    searchTime = lastSearchTime + fragmentDuration;
                    req = self.adapter.getFragmentRequestForTime(finder.streamProcessor, trackInfo, searchTime);
                    findLiveEdge.call(self, searchTime, function() {
                        binarySearch.call(self, true, searchTime);
                    }, function(){
                        callback(new MediaPlayer.rules.SwitchRequest(searchTime, p));
                    }, req);

                    return;
                }
            }

            binarySearch.call(this, true, lastSearchTime);
        },

        binarySearch = function(lastSearchSucceeded, lastSearchTime) {
            var isSearchCompleted,
                req,
                searchTime;

            if (lastSearchSucceeded) {
                liveEdgeSearchRange.start = lastSearchTime;
            } else {
                liveEdgeSearchRange.end = lastSearchTime;
            }

            isSearchCompleted = (Math.floor(liveEdgeSearchRange.end - liveEdgeSearchRange.start)) <= fragmentDuration;

            if (isSearchCompleted) {
                // search completed, we should take the time of the last found fragment. If the last search succeded we
                // take this time. Otherwise, we should subtract the time of the search step which is equal to fragment duaration
                callback(new MediaPlayer.rules.SwitchRequest((lastSearchSucceeded ? lastSearchTime : (lastSearchTime - fragmentDuration)), p));
            } else {
                // update the search time and continue searching
                searchTime = ((liveEdgeSearchRange.start + liveEdgeSearchRange.end) / 2);
                req = this.adapter.getFragmentRequestForTime(finder.streamProcessor, trackInfo, searchTime);
                findLiveEdge.call(this, searchTime, onSearchForFragmentSucceeded, onSearchForFragmentFailed, req);
            }
        };

    return {
        metricsExt: undefined,
        adapter: undefined,
        timelineConverter: undefined,

        setFinder: function(liveEdgeFinder) {
            finder = liveEdgeFinder;
        },

        execute: function(context, callbackFunc) {
            var self = this,
                request,
                DVRWindow; // all fragments are supposed to be available in this interval

            callback = callbackFunc;
            trackInfo = finder.streamProcessor.getCurrentTrack();
            fragmentDuration = trackInfo.fragmentDuration;
            DVRWindow = trackInfo.DVRWindow; // all fragments are supposed to be available in this interval

            // start position of the search, it is supposed to be a live edge - the last available fragment for the current mpd
            liveEdgeInitialSearchPosition = DVRWindow.end;

            if (trackInfo.useCalculatedLiveEdgeTime) {
                //By default an expected live edge is the end of the last segment.
                // A calculated live edge ('end' property of a range returned by TimelineConverter.calcSegmentAvailabilityRange)
                // is used as an initial point for finding the actual live edge.
                // But for SegmentTimeline mpds (w/o a negative @r) the end of the
                // last segment is the actual live edge. At the same time, calculated live edge is an expected live edge.
                // Thus, we need to switch an expected live edge and actual live edge for SegmentTimelne streams.
                var actualLiveEdge = self.timelineConverter.getExpectedLiveEdge();
                self.timelineConverter.setExpectedLiveEdge(liveEdgeInitialSearchPosition);
                callback(new MediaPlayer.rules.SwitchRequest(actualLiveEdge, p));
                return;
            }

            // we should search for a live edge in a time range which is limited by SEARCH_TIME_SPAN.
            liveEdgeSearchRange = {start: Math.max(0, (liveEdgeInitialSearchPosition - SEARCH_TIME_SPAN)), end: liveEdgeInitialSearchPosition + SEARCH_TIME_SPAN};
            // we have to use half of the availability interval (window) as a search step to ensure that we find a fragment in the window
            liveEdgeSearchStep = Math.floor((DVRWindow.end - DVRWindow.start) / 2);
            // start search from finding a request for the initial search time
            request = self.adapter.getFragmentRequestForTime(finder.streamProcessor, trackInfo, liveEdgeInitialSearchPosition);
            findLiveEdge.call(self, liveEdgeInitialSearchPosition, onSearchForFragmentSucceeded, onSearchForFragmentFailed, request);
        },

        reset: function() {
            liveEdgeInitialSearchPosition = NaN;
            liveEdgeSearchRange = null;
            liveEdgeSearchStep = NaN;
            trackInfo = null;
            useBinarySearch = false;
            fragmentDuration = NaN;
            finder = null;
        }
    };
};

MediaPlayer.rules.LiveEdgeBinarySearchRule.prototype = {
    constructor: MediaPlayer.rules.LiveEdgeBinarySearchRule
};;MediaPlayer.rules.PendingRequestsRule = function () {
    "use strict";

    var LIMIT = 3,
        scheduleController = {};

    return {
        metricsExt: undefined,

        setScheduleController: function(scheduleControllerValue) {
            var streamId = scheduleControllerValue.streamProcessor.getStreamInfo().id;
            scheduleController[streamId] = scheduleController[streamId] || {};
            scheduleController[streamId][scheduleControllerValue.streamProcessor.getType()] = scheduleControllerValue;
        },

        execute: function(context, callback) {
            var mediaType = context.getMediaInfo().type,
                streamId = context.getStreamInfo().id,
                current = context.getCurrentValue(),
                sc = scheduleController[streamId][mediaType],
                model = sc.getFragmentModel(),
                pendingRequests = model.getPendingRequests(),
                loadingRequests = model.getLoadingRequests(),
                rejectedRequests = model.getRejectedRequests(),
                rLn = rejectedRequests.length,
                ln = pendingRequests.length + loadingRequests.length,
                count = Math.max(current - ln, 0);

            if (rLn > 0) {
                callback(new MediaPlayer.rules.SwitchRequest(rLn, MediaPlayer.rules.SwitchRequest.prototype.DEFAULT));
                return;
            }

            if (ln > LIMIT) {
                callback(new MediaPlayer.rules.SwitchRequest(0, MediaPlayer.rules.SwitchRequest.prototype.DEFAULT));
                return;
            }

            if (current === 0) {
                callback(new MediaPlayer.rules.SwitchRequest(count, MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE));
                return;
            }

            callback(new MediaPlayer.rules.SwitchRequest(count, MediaPlayer.rules.SwitchRequest.prototype.DEFAULT));
        },

        reset: function() {
            scheduleController = {};
        }
    };
};

MediaPlayer.rules.PendingRequestsRule.prototype = {
    constructor: MediaPlayer.rules.PendingRequestsRule
};;MediaPlayer.rules.PlaybackTimeRule = function () {
    "use strict";

    var seekTarget = {},
        scheduleController = {},

        onPlaybackSeeking = function(sender, time) {
            var streamId = sender.getStreamId();
            seekTarget[streamId] = seekTarget[streamId] || {};
            seekTarget[streamId].audio = time;
            seekTarget[streamId].video = time;
        };

    return {
        adapter: undefined,
        sourceBufferExt: undefined,

        setup: function() {
            this.playbackSeeking = onPlaybackSeeking;
        },

        setScheduleController: function(scheduleControllerValue) {
            var streamId = scheduleControllerValue.streamProcessor.getStreamInfo().id;
            scheduleController[streamId] = scheduleController[streamId] || {};
            scheduleController[streamId][scheduleControllerValue.streamProcessor.getType()] = scheduleControllerValue;
        },

        execute: function(context, callback) {
            var mediaType = context.getMediaInfo().type,
                streamId = context.getStreamInfo().id,
                sc = scheduleController[streamId][mediaType],
                // EPSILON is used to avoid javascript floating point issue, e.g. if request.startTime = 19.2,
                // request.duration = 3.83, than request.startTime + request.startTime = 19.2 + 1.92 = 21.119999999999997
                EPSILON = 0.1,
                streamProcessor = scheduleController[streamId][mediaType].streamProcessor,
                track = streamProcessor.getCurrentTrack(),
                st = seekTarget[streamId] ? seekTarget[streamId][mediaType] : null,
                p = st ? MediaPlayer.rules.SwitchRequest.prototype.STRONG  : MediaPlayer.rules.SwitchRequest.prototype.DEFAULT,
                rejected = sc.getFragmentModel().getRejectedRequests().shift(),
                keepIdx = !!rejected && !st,
                currentTime = this.adapter.getIndexHandlerTime(streamProcessor),
                playbackTime = streamProcessor.playbackController.getTime(),
                rejectedEnd = rejected ? rejected.startTime + rejected.duration : null,
                useRejected = rejected && ((rejectedEnd > playbackTime) && (rejected.startTime <= currentTime) || isNaN(currentTime)),
                range,
                time,
                request;

            time = st || (useRejected ? (rejected.startTime) : currentTime);

            if (isNaN(time)) {
                callback(new MediaPlayer.rules.SwitchRequest(null, p));
                return;
            }

            if (seekTarget[streamId]) {
                seekTarget[streamId][mediaType] = null;
            }

            range = this.sourceBufferExt.getBufferRange(streamProcessor.bufferController.getBuffer(), time);

            if (range !== null) {
                time = range.end;
            }

            request = this.adapter.getFragmentRequestForTime(streamProcessor, track, time, keepIdx);

            if (useRejected && request && request.index !== rejected.index) {
                request = this.adapter.getFragmentRequestForTime(streamProcessor, track, rejected.startTime + (rejected.duration / 2) + EPSILON, keepIdx);
            }

            while (request && streamProcessor.fragmentController.isFragmentLoadedOrPending(sc, request)) {
                if (request.action === "complete") {
                    request = null;
                    this.adapter.setIndexHandlerTime(streamProcessor, NaN);
                    break;
                }

                request = this.adapter.getNextFragmentRequest(streamProcessor, track);
            }

            if (request && !useRejected) {
                this.adapter.setIndexHandlerTime(streamProcessor, request.startTime + request.duration);
            }

            callback(new MediaPlayer.rules.SwitchRequest(request, p));
        },

        reset: function() {
            seekTarget = {};
            scheduleController = {};
        }
    };
};

MediaPlayer.rules.PlaybackTimeRule.prototype = {
    constructor: MediaPlayer.rules.PlaybackTimeRule
};;MediaPlayer.rules.RulesController = function () {
    "use strict";

    var rules = {},

        ruleMandatoryProperties = ["execute"],

        isRuleTypeSupported = function(ruleType) {
            return ((ruleType === this.SCHEDULING_RULE) || (ruleType === this.ABR_RULE));
        },

        isRule = function(obj) {
            var ln = ruleMandatoryProperties.length,
                i = 0;

            for (i; i < ln; i += 1) {
                if (!obj.hasOwnProperty(ruleMandatoryProperties[i])) return false;
            }

            return true;
        },

        getRulesContext = function(streamProcessor, currentValue) {
            return new MediaPlayer.rules.RulesContext(streamProcessor, currentValue);
        },

        normalizeRule = function(rule) {
            var exec = rule.execute.bind(rule);

            rule.execute = function(context, callback) {
                var normalizedCallback = function(result) {
                    callback.call(rule, new MediaPlayer.rules.SwitchRequest(result.value, result.priority));
                };

                exec(context, normalizedCallback);
            };

            if (typeof(rule.reset) !== "function") {
                rule.reset = function(){
                    //TODO do some default clearing
                };
            }

            return rule;
        },

        updateRules = function(currentRulesCollection, newRulesCollection, override) {
            var rule,
                ruleSubType,
                subTypeRuleSet,
                ruleArr,
                ln,
                i;

            for (ruleSubType in newRulesCollection) {
                ruleArr = newRulesCollection[ruleSubType];
                ln = ruleArr.length;

                if (!ln) continue;

                for (i = 0; i < ln; i += 1) {
                    rule = ruleArr[i];

                    if (!isRule.call(this, rule)) continue;

                    rule = normalizeRule.call(this, rule);

                    subTypeRuleSet = currentRulesCollection.getRules(ruleSubType);

                    if (override) {
                        subTypeRuleSet.length = 0;
                    }

                    subTypeRuleSet.push(rule);
                }
            }
        };

    return {
        system: undefined,
        debug: undefined,

        SCHEDULING_RULE: 0,
        ABR_RULE: 1,

        initialize: function() {
            rules[this.ABR_RULE] = this.system.getObject("abrRulesCollection");
            rules[this.SCHEDULING_RULE] = this.system.getObject("scheduleRulesCollection");
        },

        setRules: function(ruleType, rulesCollection) {
            if (!isRuleTypeSupported.call(this, ruleType) || !rulesCollection) return;

            updateRules.call(this, rules[ruleType], rulesCollection, true);
        },

        addRules: function(ruleType, rulesCollection) {
            if (!isRuleTypeSupported.call(this, ruleType) || !rulesCollection) return;

            updateRules.call(this, rules[ruleType], rulesCollection, false);
        },

        applyRules: function(rulesArr, streamProcessor, callback, current, overrideFunc) {
            var rulesCount = rulesArr.length,
                ln = rulesCount,
                values = {},
                rulesContext = getRulesContext.call(this, streamProcessor, current),
                rule,
                i,

                callbackFunc = function(result) {
                    var value,
                        confidence;

                    if (result.value !== MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE) {
                        values[result.priority] = overrideFunc(values[result.priority], result.value);
                    }

                    if (--rulesCount) return;

                    if (values[MediaPlayer.rules.SwitchRequest.prototype.WEAK] !== MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE) {
                        confidence = MediaPlayer.rules.SwitchRequest.prototype.WEAK;
                        value = values[MediaPlayer.rules.SwitchRequest.prototype.WEAK];
                    }

                    if (values[MediaPlayer.rules.SwitchRequest.prototype.DEFAULT] !== MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE) {
                        confidence = MediaPlayer.rules.SwitchRequest.prototype.DEFAULT;
                        value = values[MediaPlayer.rules.SwitchRequest.prototype.DEFAULT];
                    }

                    if (values[MediaPlayer.rules.SwitchRequest.prototype.STRONG] !== MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE) {
                        confidence = MediaPlayer.rules.SwitchRequest.prototype.STRONG;
                        value = values[MediaPlayer.rules.SwitchRequest.prototype.STRONG];
                    }

                    if (confidence != MediaPlayer.rules.SwitchRequest.prototype.STRONG &&
                        confidence != MediaPlayer.rules.SwitchRequest.prototype.WEAK) {
                        confidence = MediaPlayer.rules.SwitchRequest.prototype.DEFAULT;
                    }

                    callback({value: (value !== undefined) ? value : current, confidence: confidence});
                };

            values[MediaPlayer.rules.SwitchRequest.prototype.STRONG] = MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE;
            values[MediaPlayer.rules.SwitchRequest.prototype.WEAK] = MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE;
            values[MediaPlayer.rules.SwitchRequest.prototype.DEFAULT] = MediaPlayer.rules.SwitchRequest.prototype.NO_CHANGE;

            for (i = 0; i < ln; i += 1) {
                rule = rulesArr[i];

                if (!isRule.call(this, rule)) {
                    rulesCount--;
                    continue;
                }

                rule.execute(rulesContext, callbackFunc);
            }
        },

        reset: function() {
            rules = {};
        }
    };
};

MediaPlayer.rules.RulesController.prototype = {
    constructor: MediaPlayer.rules.RulesController
};;MediaPlayer.rules.SameTimeRequestRule = function () {
    "use strict";

    var LOADING_REQUEST_THRESHOLD = 4,

        findClosestToTime = function(fragmentModels, time) {
            var req,
                r,
                pendingReqs,
                i = 0,
                j,
                pln,
                ln = fragmentModels.length;

            for (i; i < ln; i += 1) {
                pendingReqs = fragmentModels[i].getPendingRequests();
                sortRequestsByProperty.call(this, pendingReqs, "index");

                for (j = 0, pln = pendingReqs.length; j < pln; j++) {
                    req = pendingReqs[j];

                    if (isNaN(req.startTime) && (req.action !== "complete")) {
                        r = req;
                        break;
                    }

                    if ((req.startTime > time) && (!r || req.startTime < r.startTime)) {
                        r = req;
                    }
                }
            }

            return r || req;
        },

        getForTime = function(fragmentModels, currentTime) {
            var ln = fragmentModels.length,
                req,
                r = null,
                i;

            for (i = 0; i < ln; i += 1) {
                req = fragmentModels[i].getPendingRequestForTime(currentTime);

                if (req && (!r || req.startTime > r.startTime)) {
                    r = req;
                }
            }

            return r;
        },

        sortRequestsByProperty = function(requestsArray, sortProp) {
            var compare = function (req1, req2){
                if (req1[sortProp] < req2[sortProp] || (isNaN(req1[sortProp]) && req1.action !== "complete")) return -1;
                if (req1[sortProp] > req2[sortProp]) return 1;
                return 0;
            };

            requestsArray.sort(compare);

        };

    return {

        setFragmentModels: function(fragmentModels, streamid) {
            this.fragmentModels = this.fragmentModels || {};
            this.fragmentModels[streamid] = fragmentModels;
        },

        execute: function(context, callback) {
            var streamId = context.getStreamInfo().id,
                current = context.getCurrentValue(),
                p = MediaPlayer.rules.SwitchRequest.prototype.DEFAULT,
                fragmentModels = this.fragmentModels[streamId],
                type,
                model,
                sameTimeReq,
                mIdx,
                req,
                currentTime,
                wallclockTime = new Date(),
                time = null,
                reqForCurrentTime,
                mLength = fragmentModels ? fragmentModels.length : null,
                shouldWait = false,
                reqsToExecute = [],
                pendingReqs,
                loadingLength;

            if (!fragmentModels || !mLength) {
                callback(new MediaPlayer.rules.SwitchRequest([], p));
                return;
            }

            currentTime = fragmentModels[0].getContext().playbackController.getTime();
            reqForCurrentTime = getForTime(fragmentModels, currentTime);
            req = reqForCurrentTime || findClosestToTime(fragmentModels, currentTime) || current;

            if (!req) {
                callback(new MediaPlayer.rules.SwitchRequest([], p));
                return;
            }

            for (mIdx = 0; mIdx < mLength; mIdx += 1) {
                model = fragmentModels[mIdx];
                type = model.getContext().streamProcessor.getType();

                if (type !== "video" && type !== "audio") continue;

                pendingReqs = model.getPendingRequests();
                loadingLength = model.getLoadingRequests().length;

                if (model.getIsPostponed() && !isNaN(req.startTime)) continue;

                if (loadingLength > LOADING_REQUEST_THRESHOLD) {
                    callback(new MediaPlayer.rules.SwitchRequest([], p));
                    return;
                }

                time = time || ((req === reqForCurrentTime) ? currentTime : req.startTime);

                if (pendingReqs.indexOf(req) !== -1) {
                    reqsToExecute.push(req);
                    continue;
                }

                sameTimeReq = model.getPendingRequestForTime(time);

                if (sameTimeReq) {
                    reqsToExecute.push(sameTimeReq);
                    continue;
                }

                sameTimeReq = model.getLoadingRequestForTime(time) || model.getExecutedRequestForTime(time);

                if (!sameTimeReq) {
                    shouldWait = true;
                    break;
                }
            }

            reqsToExecute = reqsToExecute.filter( function(req) {
                return (req.action === "complete") || (wallclockTime.getTime() >= req.availabilityStartTime.getTime());
            });

            if (shouldWait) {
                callback(new MediaPlayer.rules.SwitchRequest([], p));
                return;
            }

            callback(new MediaPlayer.rules.SwitchRequest(reqsToExecute, p));
        }
    };
};

MediaPlayer.rules.SameTimeRequestRule.prototype = {
    constructor: MediaPlayer.rules.SameTimeRequestRule
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.rules.ScheduleRulesCollection = function () {
    "use strict";

    var fragmentsToScheduleRules = [],
        fragmentsToExecuteRules = [],
        liveEdgeRules = [],
        nextFragmentRules = [];

    return {
        bufferLevelRule: undefined,
        pendingRequestsRule: undefined,
        playbackTimeRule: undefined,
        sameTimeRequestRule: undefined,
        liveEdgeBinarySearchRule: undefined,

        getRules: function (type) {
            switch (type) {
                case MediaPlayer.rules.ScheduleRulesCollection.prototype.FRAGMENTS_TO_SCHEDULE_RULES:
                    return fragmentsToScheduleRules;
                case MediaPlayer.rules.ScheduleRulesCollection.prototype.NEXT_FRAGMENT_RULES:
                    return nextFragmentRules;
                case MediaPlayer.rules.ScheduleRulesCollection.prototype.FRAGMENTS_TO_EXECUTE_RULES:
                    return fragmentsToExecuteRules;
                case MediaPlayer.rules.ScheduleRulesCollection.prototype.LIVE_EDGE_RULES:
                    return liveEdgeRules;
                default:
                    return null;
            }
        },

        setup: function () {
            fragmentsToScheduleRules.push(this.bufferLevelRule);
            fragmentsToScheduleRules.push(this.pendingRequestsRule);
            nextFragmentRules.push(this.playbackTimeRule);
            fragmentsToExecuteRules.push(this.sameTimeRequestRule);
            liveEdgeRules.push(this.liveEdgeBinarySearchRule);
        }
    };
};

MediaPlayer.rules.ScheduleRulesCollection.prototype = {
    constructor: MediaPlayer.rules.ScheduleRulesCollection,
    FRAGMENTS_TO_SCHEDULE_RULES: "fragmentsToScheduleRules",
    NEXT_FRAGMENT_RULES: "nextFragmentRules",
    FRAGMENTS_TO_EXECUTE_RULES: "fragmentsToExecuteRules",
    LIVE_EDGE_RULES: "liveEdgeRules"
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.rules.SwitchRequest = function (v, p) {
    "use strict";
    this.value = v;
    this.priority = p;

    if (this.value === undefined) {
        this.value = 999;
    }

    if (this.priority === undefined) {
        this.priority = 0.5;
    }
};

MediaPlayer.rules.SwitchRequest.prototype = {
    constructor: MediaPlayer.rules.SwitchRequest,
    NO_CHANGE: 999,
    DEFAULT: 0.5,
    STRONG: 1,
    WEAK: 0
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.FragmentRequest = function () {
    "use strict";
    this.action = "download";
    this.startTime = NaN;
    this.mediaType = null;
    this.type = null;
    this.duration = NaN;
    this.timescale = NaN;
    this.range = null;
    this.url = null;
    this.requestStartDate = null;
    this.firstByteDate = null;
    this.requestEndDate = null;
    this.quality = NaN;
    this.index = NaN;
    this.availabilityStartTime = null;
    this.availabilityEndTime = null;
    this.wallStartTime = null;
};

MediaPlayer.vo.FragmentRequest.prototype = {
    constructor: MediaPlayer.vo.FragmentRequest,
    ACTION_DOWNLOAD: "download",
    ACTION_COMPLETE: "complete"
};;MediaPlayer.vo.ManifestInfo = function () {
    "use strict";
    this.DVRWindowSize = NaN;
    this.loadedTime = null;
    this.availableFrom = null;
    this.minBufferTime = NaN;
    this.duration = NaN;
    this.isDynamic = false;
    this.maxFragmentDuration = null;
};

MediaPlayer.vo.ManifestInfo.prototype = {
    constructor: MediaPlayer.vo.ManifestInfo
};;MediaPlayer.vo.MediaInfo = function () {
    "use strict";
    this.id = null;
    this.index = null;
    this.type = null;
    this.streamInfo = null;
    this.trackCount = 0;
    this.lang = null;
    this.codec = null;
    this.mimeType = null;
    this.contentProtection = null;
    this.isText = false;
    this.KID = null;
};

MediaPlayer.vo.MediaInfo.prototype = {
    constructor: MediaPlayer.vo.MediaInfo
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.models.MetricsList = function () {
    "use strict";

    return {
        TcpList: [],
        HttpList: [],
        RepSwitchList: [],
        BufferLevel: [],
        PlayList: [],
        DroppedFrames: [],
        SchedulingInfo: [],
        DVRInfo: [],
        ManifestUpdate: []
    };
};

MediaPlayer.models.MetricsList.prototype = {
    constructor: MediaPlayer.models.MetricsList
};;MediaPlayer.vo.StreamInfo = function () {
    "use strict";
    this.id = null;
    this.index = null;
    this.start = NaN;
    this.duration = NaN;
    this.manifestInfo = null;
    this.isLast = true;
};

MediaPlayer.vo.StreamInfo.prototype = {
    constructor: MediaPlayer.vo.StreamInfo
};;MediaPlayer.vo.TrackInfo = function () {
    "use strict";
    this.id = null;
    this.quality = null;
    this.DVRWindow = null;
    this.fragmentDuration = null;
    this.mediaInfo = null;
    this.MSETimeOffset = null;
};

MediaPlayer.vo.TrackInfo.prototype = {
    constructor: MediaPlayer.vo.TrackInfo
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2014, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.URIFragmentData = function () {
    "use strict";
    this.t = null;
    this.xywh = null;
    this.track = null;
    this.id = null;
    this.s = null;
};

MediaPlayer.vo.URIFragmentData.prototype = {
    constructor: MediaPlayer.vo.URIFragmentData
};


/*
    From Spec http://www.w3.org/TR/media-frags/

    temporal (t)     - This dimension denotes a specific time range in the original media, such as "starting at second 10, continuing until second 20";
    spatial  (xywh)  - this dimension denotes a specific range of pixels in the original media, such as "a rectangle with size (100,100) with its top-left at coordinate (10,10)";
                       Media fragments support also addressing the media along two additional dimensions (in the advanced version defined in Media Fragments 1.0 URI (advanced)):
    track    (track) - this dimension denotes one or more tracks in the original media, such as "the english audio and the video track";
    id       (id)    - this dimension denotes a named temporal fragment within the original media, such as "chapter 2", and can be seen as a convenient way of specifying a temporal fragment.


    ## Note
    Akamai is purposing to add #s=X to the ISO standard.
        - (X) Value would be a start time to seek to at startup instead of starting at 0 or live edge
        - Allows for seeking back before the start time unlike a temporal clipping.
*/;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.metrics.BufferLevel = function () {
    "use strict";

    this.t = null;      // Real-Time | Time of the measurement of the buffer level.
    this.level = null;  // Level of the buffer in milliseconds. Indicates the playout duration for which media data of all active media components is available starting from the current playout time.
};

MediaPlayer.vo.metrics.BufferLevel.prototype = {
    constructor: MediaPlayer.vo.metrics.BufferLevel
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2014, Akamai Technologies
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.metrics.DVRInfo = function () {
    "use strict";
    this.time = null;
    this.range = null;
    this.manifestInfo = null;
};

MediaPlayer.vo.metrics.DVRInfo.prototype = {
    constructor: MediaPlayer.vo.metrics.DVRInfo
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.metrics.DroppedFrames = function () {
    "use strict";

    this.time = null;      // Real-Time | Time of the measurement of the dropped frames.
    this.droppedFrames = null;  // Number of dropped frames.
};

MediaPlayer.vo.metrics.DroppedFrames.prototype = {
    constructor: MediaPlayer.vo.metrics.DroppedFrames
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.metrics.HTTPRequest = function () {
    "use strict";

    this.stream = null;         // type of stream ("audio" | "video" etc..)
    this.tcpid = null;          // Identifier of the TCP connection on which the HTTP request was sent.
    this.type = null;           // This is an optional parameter and should not be included in HTTP request/response transactions for progressive download.
                                    // The type of the request:
                                    // - MPD
                                    // - XLink expansion
                                    // - Initialization Fragment
                                    // - Index Fragment
                                    // - Media Fragment
                                    // - Bitstream Switching Fragment
                                    // - other
    this.url = null;            // The original URL (before any redirects or failures)
    this.actualurl = null;      // The actual URL requested, if different from above
    this.range = null;          // The contents of the byte-range-spec part of the HTTP Range header.
    this.trequest = null;       // Real-Time | The real time at which the request was sent.
    this.tresponse = null;      // Real-Time | The real time at which the first byte of the response was received.
    this.tfinish = null;        // Real-Time | The real time at which the request finshed.
    this.responsecode = null;   // The HTTP response code.
    this.interval = null;       // The duration of the throughput trace intervals (ms), for successful requests only.
    this.mediaduration = null;  // The duration of the media requests, if available, in milliseconds.
    this.trace = [];            // Throughput traces, for successful requests only.
};

MediaPlayer.vo.metrics.HTTPRequest.prototype = {
    constructor: MediaPlayer.vo.metrics.HTTPRequest
};

MediaPlayer.vo.metrics.HTTPRequest.Trace = function () {
    "use strict";

    /*
     * s - Real-Time | Measurement stream start.
     * d - Measurement stream duration (ms).
     * b - List of integers counting the bytes received in each trace interval within the measurement stream.
     */
    this.s = null;
    this.d = null;
    this.b = [];
};

MediaPlayer.vo.metrics.HTTPRequest.Trace.prototype = {
    constructor : MediaPlayer.vo.metrics.HTTPRequest.Trace
};
;MediaPlayer.vo.metrics.ManifestUpdate = function () {
    "use strict";

    this.mediaType = null;
    this.type = null;                       // static|dynamic
    this.requestTime = null;                // when this manifest update was requested
    this.fetchTime = null;                  // when this manifest update was received
    this.availabilityStartTime = null;
    this.presentationStartTime = 0;      // the seek point (liveEdge for dynamic, Stream[0].startTime for static)
    this.clientTimeOffset = 0;           // the calculated difference between the server and client wall clock time
    this.currentTime = null;                // actual element.currentTime
    this.buffered = null;                   // actual element.ranges
    this.latency = 0;                       // (static is fixed value of zero. dynamic should be ((Now-@availabilityStartTime) - elementCurrentTime)
    this.streamInfo = [];
    this.trackInfo = [];
};

MediaPlayer.vo.metrics.ManifestUpdate.StreamInfo = function () {
    "use strict";

    this.id = null;         // Stream@id
    this.index = null;
    this.start = null;      // Stream@start
    this.duration = null;   // Stream@duration
};

MediaPlayer.vo.metrics.ManifestUpdate.TrackInfo = function () {
    "use strict";

    this.id = null;                         // Track@id
    this.index = null;
    this.mediaType = null;
    this.streamIndex = null;
    this.presentationTimeOffset = null;     // @presentationTimeOffset
    this.startNumber = null;                // @startNumber
    this.fragmentInfoType = null;            // list|template|timeline
};

MediaPlayer.vo.metrics.ManifestUpdate.prototype = {
    constructor: MediaPlayer.vo.metrics.ManifestUpdate
};

MediaPlayer.vo.metrics.ManifestUpdate.StreamInfo.prototype = {
    constructor: MediaPlayer.vo.metrics.ManifestUpdate.StreamInfo
};

MediaPlayer.vo.metrics.ManifestUpdate.TrackInfo.prototype = {
    constructor: MediaPlayer.vo.metrics.ManifestUpdate.TrackInfo
};;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.metrics.PlayList = function () {
    "use strict";

    this.stream = null;     // type of stream ("audio" | "video" etc..)
    this.start = null;      // Real-Time | Timestamp of the user action that starts the playback stream...
    this.mstart = null;     // Media-Time | Presentation time at which playout was requested by the user...
    this.starttype = null;  // Type of user action which triggered playout
                            //      - New playout request (e.g. initial playout or seeking)
                            //      - Resume from pause
                            //        - Other user request (e.g. user-requested quality change)
                            //        - Start of a metrics collection stream (hence earlier entries in the play list not collected)
    this.trace = [];        // List of streams of continuous rendering of decoded samples.
};

MediaPlayer.vo.metrics.PlayList.Trace = function () {
    "use strict";

    /*
     * representationid - The value of the Representation@id of the Representation from which the samples were taken.
     * subreplevel      - If not present, this metrics concerns the Representation as a whole. If present, subreplevel indicates the greatest value of any Subrepresentation@level being rendered.
     * start            - Real-Time | The time at which the first sample was rendered.
     * mstart           - Media-Time | The presentation time of the first sample rendered.
     * duration         - The duration of the continuously presented samples (which is the same in real time and media time). ―Continuously presented‖ means that the media clock continued to advance at the playout speed throughout the interval.
     * playbackspeed    - The playback speed relative to normal playback speed (i.e.normal forward playback speed is 1.0).
     * stopreason       - The reason why continuous presentation of this Representation was stopped.
     *                    Either:
     *                    representation switch
     *                    rebuffering
     *                    user request
     *                    end of Stream
     *                    end of content
     *                    end of a metrics collection stream
     */
    this.representationid = null;
    this.subreplevel = null;
    this.start = null;
    this.mstart = null;
    this.duration = null;
    this.playbackspeed = null;
    this.stopreason = null;
};

MediaPlayer.vo.metrics.PlayList.prototype = {
    constructor: MediaPlayer.vo.metrics.PlayList
};

/* Public Static Constants */
MediaPlayer.vo.metrics.PlayList.INITIAL_PLAY_START_REASON = "initial_start";
MediaPlayer.vo.metrics.PlayList.SEEK_START_REASON = "seek";

MediaPlayer.vo.metrics.PlayList.Trace.prototype = {
    constructor: MediaPlayer.vo.metrics.PlayList.Trace()
};

/* Public Static Constants */
MediaPlayer.vo.metrics.PlayList.Trace.USER_REQUEST_STOP_REASON = "user_request";
MediaPlayer.vo.metrics.PlayList.Trace.REPRESENTATION_SWITCH_STOP_REASON = "representation_switch";
MediaPlayer.vo.metrics.PlayList.Trace.END_OF_CONTENT_STOP_REASON = "end_of_content";
MediaPlayer.vo.metrics.PlayList.Trace.REBUFFERING_REASON = "rebuffering";;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.metrics.TrackSwitch = function () {
    "use strict";

    this.t = null;      // Real-Time | Time of the switch event.
    this.mt = null;     // Media-Time | The media presentation time of the earliest access unit (out of all media content components) played out from the Representation.
    this.to = null;     // value of Representation@id identifying the switch-to Representation.
    this.lto = null;    // If not present, this metrics concerns the Representation as a whole. If present, lto indicates the value of SubRepresentation@level within Representation identifying the switch-to level of the Representation.
};

MediaPlayer.vo.metrics.TrackSwitch.prototype = {
    constructor: MediaPlayer.vo.metrics.TrackSwitch
};;MediaPlayer.vo.metrics.SchedulingInfo = function () {
    "use strict";

    this.mediaType = null;                 // Type of stream ("audio" | "video" etc..)
    this.t = null;                      // Real-Time | Time of the scheduling event.

    this.type = null;                   // Type of fragment (initialization | media)
    this.startTime = null;              // Presentation start time of fragment
    this.availabilityStartTime = null;  // Availability start time of fragment
    this.duration = null;               // Duration of fragment
    this.quality = null;                // Quality of fragment
    this.range = null;                  // Range of fragment

    this.state = null;                  // Current state of fragment
};

MediaPlayer.vo.metrics.SchedulingInfo.prototype = {
    constructor: MediaPlayer.vo.metrics.SchedulingInfo
};

/* Public Static Constants */
MediaPlayer.vo.metrics.SchedulingInfo.PENDING_STATE = "pending";
MediaPlayer.vo.metrics.SchedulingInfo.LOADING_STATE = "loading";
MediaPlayer.vo.metrics.SchedulingInfo.EXECUTED_STATE = "executed";
MediaPlayer.vo.metrics.SchedulingInfo.REJECTED_STATE = "rejected";
MediaPlayer.vo.metrics.SchedulingInfo.CANCELED_STATE = "canceled";
MediaPlayer.vo.metrics.SchedulingInfo.FAILED_STATE = "failed";;/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 * 
 * Copyright (c) 2013, Digital Primates
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Digital Primates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
MediaPlayer.vo.metrics.TCPConnection = function () {
    "use strict";

    this.tcpid = null;      // Identifier of the TCP connection on which the HTTP request was sent.
    this.dest = null;       // IP Address of the interface over which the client is receiving the TCP data.
    this.topen = null;      // Real-Time | The time at which the connection was opened (sending time of the initial SYN or connect socket operation).
    this.tclose = null;     // Real-Time | The time at which the connection was closed (sending or reception time of FIN or RST or close socket operation).
    this.tconnect = null;   // Connect time in ms (time from sending the initial SYN to receiving the ACK or completion of the connect socket operation).
};

MediaPlayer.vo.metrics.TCPConnection.prototype = {
    constructor: MediaPlayer.vo.metrics.TCPConnection
};