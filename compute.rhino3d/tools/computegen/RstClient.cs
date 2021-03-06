using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace computegen
{
    class RstClient
    {
        public static void WritePythonDocs(string basePythonDirectory, ClassBuilder[] classes)
        {
            PythonClient.SpacesPerTab = 3;
            var di = new System.IO.DirectoryInfo(System.IO.Path.Combine(basePythonDirectory, "docs"));
            if( !di.Exists )
                di = System.IO.Directory.CreateDirectory("docs\\python");
            foreach (var c in classes)
            {
                StringBuilder sb = new StringBuilder();

                sb.AppendLine(c.ClassName);
                sb.AppendLine("".PadLeft(c.ClassName.Length, '='));
                sb.AppendLine();
                sb.AppendLine($".. py:module:: compute_rhino3d.{c.ClassName}");
                sb.AppendLine();

                foreach (var (method, comments) in c.Methods)
                {
                    string methodName = PythonClient.GetMethodName(method, c);
                    if (string.IsNullOrWhiteSpace(methodName))
                        continue;
                    sb.Append($".. py:function:: {methodName}(");
                    List<string> parameters = PythonClient.GetParameterNames(method, c, out int outParamCount);
                    for (int i = 0; i < parameters.Count; i++)
                    {
                        sb.Append(parameters[i] + ", ");
                    }
                    sb.AppendLine("multiple=False)");
                    sb.AppendLine();
                    StringBuilder defSummary;
                    List<ParameterInfo> parameterList;
                    ReturnInfo returnInfo;
                    PythonClient.DocCommentToPythonDoc(comments, method, 1, out defSummary, out parameterList, out returnInfo);
                    if (defSummary.Length > 0)
                    {
                        sb.Append(defSummary);
                        sb.AppendLine();
                    }
                    foreach (var p in parameterList)
                    {
                        if (p.Description.Count == 0)
                            continue;
                        string type = PythonClient.ToPythonType(p.Type);
                        if (type.IndexOf(' ') < 0)
                            sb.Append($"   :param {type} {p.Name}: {p.Description[0]}");
                        else
                            sb.Append($"   :param {p.Name}: {p.Description[0]}");

                        if (p.Description.Count > 1)
                            sb.AppendLine(" \\");
                        else
                            sb.AppendLine();
                        for (int i = 1; i < p.Description.Count; i++)
                        {
                            if (i == (p.Description.Count - 1))
                                sb.AppendLine($"      {p.Description[i]}");
                            else
                                sb.AppendLine($"      {p.Description[i]} \\");
                        }
                        if (type.IndexOf(' ') > 0)
                            sb.AppendLine($"   :type {p.Name}: {type}");
                    }
                    sb.AppendLine("   :param bool multiple: (default False) If True, all parameters are expected as lists of equal length and input will be batch processed");
                    sb.AppendLine();
                    if (returnInfo.Description.Count > 0)
                    {
                        sb.Append($"   :return: {returnInfo.Description[0]}");
                        if (returnInfo.Description.Count > 1)
                            sb.AppendLine(" \\");
                        else
                            sb.AppendLine();
                        for (int i = 1; i < returnInfo.Description.Count; i++)
                        {
                            if (i == (returnInfo.Description.Count - 1))
                                sb.AppendLine($"      {returnInfo.Description[i]}");
                            else
                                sb.AppendLine($"      {returnInfo.Description[i]} \\");
                        }
                    }
                    sb.AppendLine($"   :rtype: {PythonClient.ToPythonType(returnInfo.Type)}");
                }



                var path = System.IO.Path.Combine(di.FullName, c.ClassName + ".rst");
                System.IO.File.WriteAllText(path, sb.ToString());
            }
            var indexPath = System.IO.Path.Combine(di.FullName, "index.rst");
            WriteIndexFile(indexPath, "py", classes);
        }

        static void WriteIndexFile(string path, string languageSuffix, ClassBuilder[] classes)
        {
            string header =
@".. compute_rhino3d documentation master file.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to compute.rhino3d.{{LANGUAGE}}'s documentation!
==============================================

.. toctree::
   :maxdepth: 2
   :caption: Contents:

";
            header = header.Replace("{{LANGUAGE}}", languageSuffix);
            StringBuilder contents = new StringBuilder();
            contents.Append(header);
            foreach (var c in classes)
            {
                contents.AppendLine("   " + c.ClassName);
            }

            contents.Append(
@"
Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
");
            System.IO.File.WriteAllText(path, contents.ToString());
        }


        public static void WriteJavascriptDocs(ClassBuilder[] classes, System.IO.DirectoryInfo di)
        {
            if (!di.Exists)
                di.Create();
            foreach (var c in classes)
            {
                StringBuilder sb = new StringBuilder();

                sb.AppendLine("RhinoCompute." + c.ClassName);
                sb.AppendLine("".PadLeft(("RhinoCompute." + c.ClassName).Length, '='));
                sb.AppendLine();
                sb.AppendLine($".. js:module:: RhinoCompute");
                sb.AppendLine();

                foreach (var (method, comments) in c.Methods)
                {
                    string methodName = JavascriptClient.GetMethodName(method, c);
                    if (string.IsNullOrWhiteSpace(methodName))
                        continue;
                    sb.Append($".. js:function:: RhinoCompute.{c.ClassName}.{methodName}(");
                    List<string> parameters = PythonClient.GetParameterNames(method, c, out int outParamCount);
                    for (int i = 0; i < parameters.Count; i++)
                    {
                        sb.Append(parameters[i] + ", ");
                    }
                    sb.AppendLine("multiple=false)");
                    sb.AppendLine();
                    StringBuilder defSummary;
                    List<ParameterInfo> parameterList;
                    ReturnInfo returnInfo;
                    PythonClient.DocCommentToPythonDoc(comments, method, 1, out defSummary, out parameterList, out returnInfo);
                    if (defSummary.Length > 0)
                    {
                        var summaryLines = defSummary.ToString().Split(new char[] { '\n' });
                        foreach(var summaryLine in summaryLines)
                        {
                            if(!string.IsNullOrWhiteSpace(summaryLine))
                                sb.AppendLine($"   {summaryLine.Trim()}");
                        }
                        sb.AppendLine();
                    }

                    foreach (var p in parameterList)
                    {
                        if (p.Description.Count == 0)
                            continue;
                        string type = PythonClient.ToPythonType(p.Type);
                        if (type.IndexOf(' ') < 0)
                            sb.Append($"   :param {type} {p.Name}: {p.Description[0]}");
                        else
                            sb.Append($"   :param {p.Name}: {p.Description[0]}");

                        if (p.Description.Count > 1)
                            sb.AppendLine(" \\");
                        else
                            sb.AppendLine();
                        for (int i = 1; i < p.Description.Count; i++)
                        {
                            if (i == (p.Description.Count - 1))
                                sb.AppendLine($"      {p.Description[i]}");
                            else
                                sb.AppendLine($"      {p.Description[i]} \\");
                        }
                        if (type.IndexOf(' ') > 0)
                            sb.AppendLine($"   :type {p.Name}: {type}");
                    }
                    sb.AppendLine("   :param bool multiple: (default False) If True, all parameters are expected as lists of equal length and input will be batch processed");
                    sb.AppendLine();
                    if (returnInfo.Description.Count > 0)
                    {
                        sb.Append($"   :return: {returnInfo.Description[0]}");
                        if (returnInfo.Description.Count > 1)
                            sb.AppendLine(" \\");
                        else
                            sb.AppendLine();
                        for (int i = 1; i < returnInfo.Description.Count; i++)
                        {
                            if (i == (returnInfo.Description.Count - 1))
                                sb.AppendLine($"      {returnInfo.Description[i]}");
                            else
                                sb.AppendLine($"      {returnInfo.Description[i]} \\");
                        }
                    }
                    sb.AppendLine($"   :rtype: {PythonClient.ToPythonType(returnInfo.Type)}");
                }

                var path = System.IO.Path.Combine(di.FullName, c.ClassName + ".rst");
                System.IO.File.WriteAllText(path, sb.ToString());
            }
            var indexPath = System.IO.Path.Combine(di.FullName, "index.rst");
            WriteIndexFile(indexPath, "js", classes);
        }
    }
}
