var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');
var Random = require('random-js');

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["subject.js"];
	}
	var filePath = args[0];
	nameOfFile=filePath.split('.').shift();

	constraints(filePath);

	generateTestCases()

	fakeDemo();

}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue( greaterThan, constraintValue )
{
	if( greaterThan )
		return Random.integer(constraintValue,constraintValue+10)(engine);
	else
		return Random.integer(constraintValue-10,constraintValue)(engine);
}

function Constraint(properties)
{
	this.ident = properties.ident;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.funcName = properties.funcName;
	// Supported kinds: "fileWithContent","fileExists"
	// integer, string, phoneNumber
	this.kind = properties.kind;
}

function fakeDemo()
{
	console.log( faker.phone.phoneNumber() );
	console.log( faker.phone.phoneNumberFormat() );
	console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary = 
{
	pathExists:
	{
		'path/fileExists': {}
		

	},

	pathWithFile:
	{

		'dir/file': {'file1':'text content'}

	},


	
	fileWithContent:
	{
		pathContent: 
		{	
  			file1: 'text content'
  			
  			
		}
	},
	fileWithoutContent:
	{
		pathContent:
		{
			file2: ''
		}
	}
};

function generateTestCases()
{

	var content = "var subject = require('./subject.js')\nvar mock = require('mock-fs');\n";
	for ( var funcName in functionConstraints )
	{
		var params = {};

		// initialize params
		for (var i =0; i < functionConstraints[funcName].params.length; i++ )
		{
			var paramName = functionConstraints[funcName].params[i];
			//params[paramName] = '\'' + faker.phone.phoneNumber()+'\'';
			//params[paramName] = '\'\'';
			params[paramName]=new Array();

			

			
		}

		//console.log( params );

		// update parameter values based on known constraints.
		var constraints = functionConstraints[funcName].constraints;
		// Handle global constraints...
		var fileWithContent = _.some(constraints, {kind: 'fileWithContent' });
		var pathExists      = _.some(constraints, {kind: 'fileExists' });
		var pathWithFile    = _.some(constraints, {kind: 'pathWithFile'});
		var fileWithoutContent = _.some(constraints, {kind: 'fileWithoutContent'});

		// plug-in values for parameters
		for( var c = 0; c < constraints.length; c++ )
		{
			var constraint = constraints[c];
			if( params.hasOwnProperty( constraint.ident ) )
			{
				//params[constraint.ident] = constraint.value;
				params[constraint.ident].push(constraint.value);
				//console.log("Param values for one parameter",params[constraint.ident])
			}
			
		}

        allParams = Object.keys(params).map(function(k){return params[k];});
        
        
        console.log("All params for one function",funcName,allParams); 
        var result=allCombo(allParams);
        
        console.log("All combinations of params for one function",funcName, result);
		// Prepare function arguments.
		//var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");

        for(var l=0;l<result.length;l++)
        { 
        

        
        var args=result[l];
        
        


        console.log("Args for one function are",funcName, args);

		if( pathExists || fileWithContent || pathWithFile || fileWithoutContent )
		{
			
			// Bonus...generate constraint variations test cases....
			content += generateMockFsTestCases(!pathExists,!fileWithContent,!pathWithFile, !fileWithoutContent,funcName, args);
			content += generateMockFsTestCases(pathExists, fileWithContent,pathWithFile, fileWithoutContent, funcName, args);
			
			content += generateMockFsTestCases(pathExists,fileWithContent,!pathWithFile, !fileWithoutContent, funcName, args);
            content += generateMockFsTestCases(pathExists, !fileWithContent,!pathWithFile, fileWithoutContent, funcName, args);
            content += generateMockFsTestCases(!pathExists, fileWithContent,pathWithFile, !fileWithoutContent, funcName, args);
            content += generateMockFsTestCases(!pathExists, !fileWithContent,pathWithFile, fileWithoutContent, funcName, args);
            
            content += generateMockFsTestCases(!pathExists, fileWithContent,pathWithFile, fileWithoutContent, funcName, args);
            content += generateMockFsTestCases(pathExists, !fileWithContent, pathWithFile, fileWithoutContent, funcName, args);
            content += generateMockFsTestCases(pathExists, fileWithContent, !pathWithFile, fileWithoutContent, funcName, args);
            content += generateMockFsTestCases(pathExists, fileWithContent, pathWithFile, !fileWithoutContent, funcName, args);


		}
		else
		{
			
			// Emit simple test case.
			content += nameOfFile+".{0}({1});\n".format(funcName, args );
		}
	    }
     }
	


	fs.writeFileSync('test.js', content, "utf8");

}

function generateMockFsTestCases (pathExists,fileWithContent,pathWithFile, fileWithoutContent, funcName,args) 
{
	var testCase = "";
	// Build mock file system based on constraints.
	var mergedFS = {};
	if( pathExists )
	{
		for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
	}
	if( fileWithContent )
	{
		for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
	}
    if( pathWithFile )
    {
    	for (var attrname in mockFileLibrary.pathWithFile) { mergedFS[attrname] = mockFileLibrary.pathWithFile[attrname]; }
    }
    if( fileWithoutContent )
    {
    	for( var attrname in mockFileLibrary.fileWithoutContent) {mergedFS[attrname] = mockFileLibrary.fileWithoutContent[attrname]; }
    }

	testCase += 
	"mock(" +
		JSON.stringify(mergedFS)
		+
	");\n";
    console.log("Func Name in MockFs", funcName);
    console.log("Args in MockFs", args);
	testCase += "\t"+nameOfFile+".{0}({1});\n".format(funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
    var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node) 
	{
		if (node.type === 'FunctionDeclaration') 
		{
			var funcName = functionName(node);
			console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			// Check for expressions using argument.
			traverse(node, function(child)
			{



				if( child.type === 'BinaryExpression' && child.operator == "==")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1 && typeof child.right.value === 'undefined')
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),

                            new Constraint(
							{
								ident: child.left.name,
								value: parseInteger(rightHand)+1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							})

							);
					}
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1 && typeof child.right.value === 'string')
					{   
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						var mystring = rightHand.substring(1,rightHand.length-1)
						
					

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.left.name,
								value: "\""+mystring+"a"+"\"",
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							})
							
                            

							);
					}
					if(child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1 && typeof child.right.value === 'integer')
					{
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),
                            new Constraint(
							{
								ident: child.left.name,
								value: rightHand+1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							})

                            

							);
					}

					if(child.left.type == 'CallExpression' && child.left.callee.property && params.indexOf(child.left.callee.object.name) > -1)
                    {
                     
                           var expression = buf.substring(child.range[0], child.range[1]);
       
                            
                            console.log("Ident",child.left.callee.object.name);
                            console.log("value",child.left.arguments[0].value);
                            
                            console.log("function name",funcName);
                           
                           console.log("operator",child.operator);

                          functionConstraints[funcName].constraints.push( 
                          new Constraint(
                            {
                                ident: child.left.callee.object.name,
                                value: "\""+child.left.arguments[0].value+"\"",
                                funcName: funcName,
                                kind: "string",
                                operator : child.operator,
                                expression: expression
                          
                            }),
                          new Constraint(
                            {
                                ident: child.left.callee.object.name,
                                value: "\""+child.left.arguments[0].value+"a"+"\"",
                                funcName: funcName,
                                kind: "string",
                                operator : child.operator,
                                expression: expression
                          
                            })

                        );
                            

                                         
                                
                        }
                       
                     

                  

					
				}
				if( child.type === 'BinaryExpression' && child.operator == "!=")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1 && typeof child.right.value === 'undefined')
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),

                            new Constraint(
							{
								ident: child.left.name,
								value: parseInteger(rightHand)+1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							})

							);
					}
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1 && typeof child.right.value === 'string')
					{   
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						var mystring = rightHand.substring(1,rightHand.length-1)
						
					

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.left.name,
								value: "\""+mystring+"a"+"\"",
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							})
							
                            

							);
					}
					if(child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1 && typeof child.right.value === 'integer')
					{
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),
                            new Constraint(
							{
								ident: child.left.name,
								value: rightHand+1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							})

                            

							);
					}

					if(child.left.type == 'CallExpression' && child.left.callee.property && params.indexOf(child.left.callee.object.name) > -1)
                    {
                     
                           var expression = buf.substring(child.range[0], child.range[1]);
       
                            
                            console.log("Ident",child.left.callee.object.name);
                            console.log("value",child.left.arguments[0].value);
                            
                            console.log("function name",funcName);
                           
                           console.log("operator",child.operator);

                          functionConstraints[funcName].constraints.push( 
                          new Constraint(
                            {
                                ident: child.left.callee.object.name,
                                value: "\""+child.left.arguments[0].value+"\"",
                                funcName: funcName,
                                kind: "string",
                                operator : child.operator,
                                expression: expression
                          
                            }),
                          new Constraint(
                            {
                                ident: child.left.callee.object.name,
                                value: "\""+child.left.arguments[0].value+"a"+"\"",
                                funcName: funcName,
                                kind: "string",
                                operator : child.operator,
                                expression: expression
                          
                            })

                        );
                            

                                         
                                
                        }
                    
                     

                  

					
				}
				if( child.type === 'BinaryExpression' && child.operator == "<")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
                            new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand)-1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),

							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand)+1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand),
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							})
							
							
							
							
							);
					}
				}

              
                    if(child.type == 'BinaryExpression' && child.operator == ">") 
                    {
                          
                          
                          if(child.left.type == 'Identifier' && params.indexOf(child.left.name) > -1)
                          {
                             var expression = buf.substring(child.range[0], child.range[1]);
						     var rightHand = buf.substring(child.right.range[0], child.right.range[1])

                             functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand)+1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),
                             new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand)-1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}),
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand),
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							})							

							);




                          }
                          }	

                    if(child.type == 'AssignmentExpression' && child.operator == '=')
                    {
                        if(child.left.type=='Identifier' && params.indexOf(child.left.name)>-1 && child.right.type=='CallExpression' && child.right.callee.name)
                        {
                        	console.log("Gauri Naik")
                        	var x=faker.phone.phoneNumberFormat().substring(0,3);
                            functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: faker.phone.phoneNumberFormat(),
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							}),
                            new Constraint(
							{
								ident: child.left.name,
								value: x.replace("212"),
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							})

                           

							);

                        }

                    }
                    if(child.type=='CallExpression' && child.callee.name && params.indexOf(child.arguments[0].name)>-1 )
                    {       var x=faker.phone.phoneNumberFormat().substring(0,3);

                            functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.arguments[0].name,
								value: faker.phone.phoneNumberFormat(),
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							}),
                            new Constraint(
							{
								ident: child.arguments[0].name,
								value: x.replace("212"),
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							})

                           

							);     

                    }

                    if(child.type=='CallExpression' && child.callee.property && params.indexOf(child.callee.object.name)>-1 )
                    {
                    	var x=faker.phone.phoneNumberFormat().substring(0,3);
                         functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.callee.object.name,
								value: faker.phone.phoneNumberFormat(),
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							}),
                            new Constraint(
							{
								ident: child.callee.object.name,
								value: x.replace("212"),
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							})

                           

							);     


                    }

                      if(child.type=='LogicalExpression' && child.operator=='||')

                    {
                    	if(child.right.argument.type=='MemberExpression' && params.indexOf(child.right.argument.object.name)>-1 && child.right.argument.property)
                    {
                    	functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.right.argument.object.name,
								value: "{\""+child.right.argument.property.name+"\":false}",
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							}),
                            new Constraint(
							{
								ident: child.right.argument.object.name,
								value: "{\""+child.right.argument.property.name+"\":true}",
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							})

                           

							);     

                    }

                   }
                  
				


				if( child.type == "CallExpression" && 
					 child.callee.property &&
					 child.callee.property.name =="readFileSync"  )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							console.log("Params in readFileSync", params[p]);
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value:  "'pathContent/file1'",
								funcName: funcName,
								kind: "fileWithContent",
								operator : child.operator,
								expression: expression
							}),
                            new Constraint(
							{
								ident: params[p],
								value:  "'pathContent/file2'",
								funcName: funcName,
								kind: "fileWithoutContent",
								operator : child.operator,
								expression: expression
							})



							);
						}
					}
				}
                if( child.type == "CallExpression" && 
					 child.callee.property &&
					 child.callee.property.name =="readdirSync"  )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							console.log("Params in readdirSync", params[p]);
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value:  "'path/fileExists'",
								funcName: funcName,
								kind: "pathExists",
								operator : child.operator,
								expression: expression
							}),
                            new Constraint(
							{
								ident: params[p],
								value:  "'dir/file'",
								funcName: funcName,
								kind: "pathWithFile",
								operator : child.operator,
								expression: expression
							})



							);
						}
					}
				}



				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="existsSync" && child.arguments[0].name == "dir")
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							console.log("Params in existsSync", params[p]);
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								// A fake path to a file
								value:  "'path/fileExists'",
								funcName: funcName,
								kind: "pathExists",
								operator : child.operator,
								expression: expression
							}),
                             new Constraint(
							{
								ident: params[p],
								// A fake path to a file
								value:  "'dir/file'",
								funcName: funcName,
								kind: "pathWithFile",
								operator : child.operator,
								expression: expression
							})
                           



							);
						}
					}
				}

				if(child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="existsSync" && child.arguments[0].name == "filePath")
				{
                    for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							console.log("Params in existsSync", params[p]);
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								// A fake path to a file
								value:  "'pathContent/file1'",
								funcName: funcName,
								kind: "fileWithContent",
								operator : child.operator,
								expression: expression
							}),
                             new Constraint(
							{
								ident: params[p],
								// A fake path to a file
								value:  "'pathContent/file2'",
								funcName: funcName,
								kind: "fileWithoutContent",
								operator : child.operator,
								expression: expression
							})
                           



							);
						}
					}
                    
				}


				

			});

			console.log( functionConstraints[funcName]);

		}
	});
}

function traverse(object, visitor) 
{
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
	    for (key in object) {
	        if (object.hasOwnProperty(key)) {
	            child = object[key];
	            if (typeof child === 'object' && child !== null) {
	                traverseWithCancel(child, visitor);
	            }
	        }
	    }
 	 }
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}

function parseInteger(parameter)
{
   if(parameter==='undefined') {
   	return 0;
   }


}



if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}


//Only this function in the entire code was referred to from Stack Overflow.
function allCombo(arr)
{
	if (arr.length === 0) {
    return [];
      } 
    if (arr.length ===1) {
       return arr[0];
     }
    else {
	 var result = [];
	 var RemainingArray = allCombo(arr.slice(1));  
     for (var c in RemainingArray) {
       for (var i = 0; i < arr[0].length; i++) {
        result.push(arr[0][i] +',' +RemainingArray[c]);
      }
    }
    return result;
  }
}


main();
