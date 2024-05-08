'use strict';
(function () {
    setupSubmit();
    function setupSubmit() {
        document.getElementById('submit').addEventListener('click', (event) => {
            const data = document.getElementsByName('files');
            let dataFiles = data[0].files 
            Init(dataFiles)
        });
    }

    async function Init(files) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/build/pdf.worker.mjs';
        let articlePreCSV = [];
        let authorsPreCSV = [];
        let referencesPreCSV = [];
        let secoesPreCSV = [];
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                var base64Data = await readFileAsDataURL(files[i]);
                articlePreCSV.push(await lerArticlePDF(base64Data, i+1, files[i].name));
                authorsPreCSV.push(...(await lerAuthorsPDF(base64Data, i+1)));
                referencesPreCSV.push(...(await lerReferencesPDF(base64Data, i+1)));
            }
        }

        secoesPreCSV.push(await lerSecoesPDF())
        convertArticleToCSV(articlePreCSV);
        convertAuthorsToCSV(authorsPreCSV);
        convertReferencesToCSV(referencesPreCSV);
        convertSecoesToCSV(secoesPreCSV);
    }

    function readFileAsDataURL(file) {
        var fileReader = new FileReader();
        var base64;
        return new Promise((resolve, reject) => {
            fileReader.onload = function(fileLoadedEvent) {
                base64 = fileLoadedEvent.target.result;
                resolve(base64);
            };
            fileReader.onerror = reject;
            fileReader.readAsDataURL(file);
        });
    }

    //isso aqui preenche pra um arquivo
    async function lerArticlePDF(fileToLoad, index, fileName) {
        let pdf = await pdfjsLib.getDocument(fileToLoad).promise
        var pdfDocument = pdf;
        var numPages = pdfDocument.numPages;
        var firstPageText = await getPageText(1, pdfDocument);
        var secondPageText = await getPageText(2, pdfDocument);

        var language = getLanguage(firstPageText, secondPageText);
        var article = getArticle(firstPageText, numPages, index, language, fileName);
        return article
    }

    async function lerAuthorsPDF(fileToLoad, index) {
        let pdf = await pdfjsLib.getDocument(fileToLoad).promise
        var pdfDocument = pdf;
        var numPages = pdfDocument.numPages;
        var firstPageText = await getPageText(1, pdfDocument);
        var authors = getAuthors(firstPageText, index);
        return authors
    }

    async function lerReferencesPDF(fileToLoad, index) {
        let pdf = await pdfjsLib.getDocument(fileToLoad).promise
        var pdfDocument = pdf;
        var numPages = pdfDocument.numPages;
        var references = getReferences(pdfDocument, numPages, index);
        return references
    }

    async function lerSecoesPDF(fileToLoad, index) {
        let sectionTitle = document.getElementById("sectionTitle").value;
        let sectionTitleEn = document.getElementById("sectionTitleEn").value;
        let sectionAbbrev = document.getElementById("sectionAbbrev").value;
        let blind = document.getElementById("blind").value;
        let numSubmitted = document.getElementById("numSubmitted").value;
        let numAccepted = document.getElementById("numAccepted").value;
        let dateSub = document.getElementById("dateSub").value;
        let dateResult = document.getElementById("dateResult").value;
        let dateReady = document.getElementById("dateReady").value;
        let secoes = {
            sectionTitle: sectionTitle,
            sectionTitleEn: sectionTitleEn,
            sectionAbbrev: sectionAbbrev,
            blind: blind,
            numSubmitted: numSubmitted,
            numAccepted: numAccepted,
            dateSub: dateSub,
            dateResult: dateResult,
            dateReady: dateReady,
        };
        return secoes
    }

    function getPageText(pageNum, PDFDocumentInstance) {
        return new Promise(function (resolve, reject) {
            PDFDocumentInstance.getPage(pageNum).then(function (pdfPage) {
                pdfPage.getTextContent().then(function (textContent) {
                    var textItems = textContent.items;
                    console.log(textItems)
                    resolve(textItems)
                });
            });
        });
    }

    function getArticle(text, numPages, index, language, fileName){
        var article = {
            seq: "",
            language: "",
            sectionAbbrev: "",
            titleOrig: "",
            titleEn: "",
            AbstractOrig: "",
            AbstractEn: "",
            keywordsOrig: "",
            keywordsEn: "",
            pages: "",
            idJEMS: "",
        }
        article.seq = index.toString();
        article.language = language;
        article.sectionAbbrev = document.getElementById("sectionAbbrev").value;
        article.titleEn = getTitle(text);
        article.titleOrig = article.titleEn;
        article.AbstractEn = getAbstractEn(text);
        article.AbstractOrig = getAbstractOrig(text);
        article.keywordsEn = "?";
        article.keywordsOrig = "?";
        article.pages = numPages.toString();
        article.idJEMS = removeFileFormat(fileName);
        return article;
    }
    
    function getAuthors(text, index){
        var authorsResult = [];
        var authors = listAuthors(text);
        var authorsEmails = extractEmails(text);
        for(var i = 0; i < authors.length; i++){
            var author = authors[i].split(" ");
            authorsResult.push({
                article: index.toString(),
                authorFirstname: author[0],
                authorMiddlename: author.slice(1, author.length - 1).join(" "),
                authorLastname: author[author.length - 1],
                authorAffiliation: "?",
                authorAffiliationEn: "?",
                authorCountry: "BR",
                authorEmail: authorsEmails[i],
                orcid: "?",
            });
        }
        return authorsResult;
    }

    async function getReferences(file, numPages, index){
        var referencesResult = [];
        var indPage = 0
        var indArray = 0
        for (let i = 1; i <= numPages; i++) {
            let text = await getPageText(i, file)
            let size = text.length;
            let ind = 0;
            while(ind < size && !text[ind].str.includes("References") && !text[ind].str.includes("Referências") && !text[ind].str.includes("Referˆ")){
                ind++;
            }
            if(ind < size){
                indPage = i
                indArray = ind + 1
            }
        }
        let beginRefPosition
        let curStr = ""
        for (let i = indPage; i <= numPages; i++) {
            let text = await getPageText(i, file)
            let size = text.length;
            let ind = i == indPage ? indArray : 0;
            if(i == indPage) beginRefPosition = text[ind].transform[4];
            while(ind < size){
                if(beginRefPosition != text[ind].transform[4] || text[ind].str == "" || 
                    text[ind].str == " "){
                        curStr += text[ind].str + (text[ind].hasEOL ? " " : "");
                }
                else{
                    referencesResult.push({
                        article: index.toString(),
                        description: curStr,
                        doi: "?",
                        link: "?",
                        accessed: "?",
                    });
                    curStr = text[ind].str + (text[ind].hasEOL ? " " : "");
                }
                ind++;
            }
            if(i == numPages && curStr != ""){
                referencesResult.push({
                    article: index.toString(),
                    description: curStr,
                    doi: "?",
                    link: "?",
                    accessed: "?",
                });
            }
        }
        referencesResult = referencesResult.slice(1, referencesResult.length)
        for(var i = 0; i < referencesResult.length; i++){
            referencesResult[i].description = referencesResult[i].description.trim();
        }
        return referencesResult;
    }

    function getTitle(text) {
        var title = "";
        var heightTitle = text[0].height;
        var ind = 0
        while(text[ind].height == heightTitle || text[ind].height == 0){
            title += text[ind].str + (text[ind].hasEOL ? " " : "");
            ind++;
        }
        return title;
    }

    function getAbstractEn(text) {
        var abstract = "";
        var ind = 0
        while(ind < text.length && !text[ind].str.includes("Abstract")){   
            ind++;
        }

        ind+=2;
        var fontAbstract = text[ind].fontName;
        while(ind < text.length && text[ind].fontName == fontAbstract){
            abstract += text[ind].str + (text[ind].hasEOL ? " " : "");
            ind++;
        }
        return abstract;
    }

    function getAbstractOrig(text) {
        var abstract = "";
        var ind = 0
        while(ind < text.length && !text[ind].str.includes("Resumo") &&
            !text[ind].str.includes("Resumen")){
            ind++;
        }
        if(ind == text.length){
            return getAbstractEn(text);
        }
        ind += 2;
        var fontAbstract = text[ind].fontName;
        while(ind < text.length && text[ind].fontName == fontAbstract){
            abstract += text[ind].str + (text[ind].hasEOL ? " " : "");
            ind++;
        }
        return abstract;
    }

    function getLanguage(firstPageText, secondPageText){
        var ind = 0;
        while(ind < firstPageText.length && !firstPageText[ind].str.includes("Introduction")){
            ind++;
        }
        if(ind == firstPageText.length){
            ind = 0
            while(ind < secondPageText.length && !secondPageText[ind].str.includes("Introduction")){
                ind++;
            }
            if(ind != secondPageText.length){
                return "en";
            }
        }
        else return "en";
        ind = 0;
        while(ind < firstPageText.length && !firstPageText[ind].str.includes("Introducción")){
           ind++;
        }
        if(ind == firstPageText.length){
            ind = 0;
            while(ind < secondPageText.length && !secondPageText[ind].str.includes("Introducción")){
                ind++;
            }
            if(ind != secondPageText.length){
                return "es";
            }
        }
        else return "es";
        return "pt"
    }

    function listAuthors(text){
        var authors = "";
        var heightTitle = text[0].height;
        var ind = 0
        while(text[ind].height == heightTitle || text[ind].height == 0){
            ind++;
        }
        var authorsHeight = text[ind].height;
        var authorsFont = text[ind].fontName;
        while(((text[ind].height == authorsHeight && text[ind].fontName == authorsFont) || 
                isNumberBetween1And9(text[ind].str)) || text[ind].height == 0){
            if(!isNumberBetween1And9(text[ind].str)) 
            authors += text[ind].str + (text[ind].hasEOL ? " " : "");
            ind++;
        }
        let authorsNames = authors.split(",");
        for(var i = 0; i < authorsNames[authorsNames.length -1].length; i++){
            let letra = authorsNames[authorsNames.length -1][i];
            if(i > 0 && i < authorsNames[authorsNames.length -1].length - 1 && 
                    letra == "e" && authorsNames[authorsNames.length -1][i-1] == " " && 
                    authorsNames[authorsNames.length -1][i+1] == " "){
                let aux = authorsNames[authorsNames.length -1].slice(0, i)
                let aux2 = authorsNames[authorsNames.length -1].slice(i+1, 
                    authorsNames[authorsNames.length -1].length)
                authorsNames.pop();
                authorsNames.push(aux);
                authorsNames.push(aux2);
                break;
            }
        }
        for(var i = 0; i < authorsNames.length; i++) authorsNames[i] = authorsNames[i].trim();
        return authorsNames;
    }

    function convertArticleToCSV(ArticlesArray) {
        const array = convertArrayOfObjectsToCSV(ArticlesArray);
        const csvBlob = new Blob([array], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);

        chrome.downloads.download({
            url: csvUrl,
            filename: "Artigos.csv",
        });
    }

    function convertAuthorsToCSV(AuthorsArray) {
        const array = convertArrayOfObjectsToCSV(AuthorsArray);
        const csvBlob = new Blob([array], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);

        chrome.downloads.download({
            url: csvUrl,
            filename: "Autores.csv",
        });
    }

    function convertReferencesToCSV(ReferencesArray) {
        const array = convertArrayOfObjectsToCSV(ReferencesArray);
        const csvBlob = new Blob([array], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);

        chrome.downloads.download({
            url: csvUrl,
            filename: "Referencias.csv",
        });
    }

    function convertSecoesToCSV(SecoesArray) {
        const array = convertArrayOfObjectsToCSV(SecoesArray);
        const csvBlob = new Blob([array], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);

        chrome.downloads.download({
            url: csvUrl,
            filename: "Secoes.csv",
        });
    }

    function convertArrayOfObjectsToCSV(array) {
        const header = Object.keys(array[0]).map(key => `"${key}"`).join(',');
        const rows = array.map(obj => Object.values(obj).map(val => typeof val === 'string' ? `"${val}"` : val).join(','));
        return header + '\n' + rows.join('\n');
    }

    function removeFileFormat(fileName) {
        const dotIndex = fileName.lastIndexOf('.');
        
        if (dotIndex !== -1 && dotIndex !== 0) {
          // Return the fileName without the format
          return fileName.substring(0, dotIndex);
        }
        
        return fileName;
    }

    function isNumberBetween1And9(str) {
        if (!isNaN(str)) {
            const num = parseInt(str, 10);
            if (num >= 1 && num <= 9) {
                return true;
            }
        }
        return false;
    }

    function extractEmails(input) {
        input = extractEmailsFromText(input);
        let emails = []
        var stack = []
        var actStr = ""
        for(var i = 0; i < input.length; i++){
            if(input[i] == "{"){
                i++;
                while(input[i] != "}"){
                    if(input[i] != ',') actStr += input[i];
                    else stack.push(actStr), actStr = "";
                    i++;
                }
                i++;
                stack.push(actStr), actStr = "";
                let suffix = ""
                while(i < input.length && input[i] != ","){
                    suffix += input[i];
                    i++;
                }
                for(var j = 0; j < stack.length; j++){
                    emails.push(stack[j] + suffix);
                }
                stack = [];
            }
            else{
                if(input[i] != ',') actStr += input[i];
                if(input[i] == ',' || i == input.length - 1){
                    emails.push(actStr)
                    actStr = "";
                }
            }
        }
        for(var i = 0; i < emails.length; i++){
            emails[i] = emails[i].trim();
        }
        return emails;
    }

    function extractEmailsFromText(text) {
        var emails = [];
        var ind = 0
        while(ind < text.length && (!text[ind].str.includes("Abstract") && 
                !text[ind].str.includes("Resumo") && !text[ind].str.includes("Resumen"))){   
            ind++;
        }

        ind--;
        if(text[ind].height == 0) ind--;
        var heightEmail = text[ind].height
        while(ind >= 0 && (text[ind].height == heightEmail || text[ind].height == 0)){
            emails.push(text[ind].str);
            ind--;
        }
        emails.reverse()
        let emailString = ""
        for (let i = 0; i < emails.length; i++) {
            emailString += emails[i]
        }
        return emailString;
    }
    
})();