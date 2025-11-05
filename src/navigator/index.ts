/**
 * Navigator module - Bidirectional navigation between MyBatis mapper interfaces and XML files
 */

// Export core components
export { FileMapper } from './core/FileMapper';

// Export definition providers
export { JavaToXmlDefinitionProvider } from './providers/JavaToXmlDefinitionProvider';
export { XmlToJavaDefinitionProvider } from './providers/XmlToJavaDefinitionProvider';
export { JavaClassDefinitionProvider } from './providers/JavaClassDefinitionProvider';
export { XmlSqlFragmentDefinitionProvider } from './providers/XmlSqlFragmentDefinitionProvider';
export { XmlResultMapPropertyDefinitionProvider } from './providers/XmlResultMapPropertyDefinitionProvider';
export { XmlResultMapDefinitionProvider } from './providers/XmlResultMapDefinitionProvider';
export { XmlParameterDefinitionProvider } from './providers/XmlParameterDefinitionProvider';

// Export diagnostics
export { ParameterValidator } from './diagnostics/ParameterValidator';

// Export parsers (if needed externally)
export { extractJavaNamespace, isMyBatisMapper, extractJavaMethods, findJavaMethodLine, findJavaMethodPosition, extractMethodParameters } from './parsers/javaParser';
export { extractXmlNamespace, extractXmlStatements, findXmlStatementLine, findXmlStatementPosition, extractStatementIdFromPosition } from './parsers/xmlParser';
export { extractParameterReferences, extractStatementParameterInfo, getParameterAtPosition } from './parsers/parameterParser';
export { extractJavaFields, findJavaField, findJavaFieldPosition } from './parsers/javaFieldParser';
