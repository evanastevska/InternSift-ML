const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");

function onGmailMessageOpen(e) {
  var messageId = e.messageMetadata.messageId;
  var message = GmailApp.getMessageById(messageId);
  var subject = message.getSubject();
  var body = message.getPlainBody();
  var sender = message.getFrom();

  var analysis = callGeminiAPI(subject, body, sender);
  return buildSidebarCard(analysis, subject);
}

function callGeminiAPI(subject, body, sender) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  const payload = {
    "contents": [{
      "parts": [{
        "text": `You are an expert admin assistant for a business owner. Your job is to filter internship inquiries.

LEGIT: Returns this if the email is from a human student asking about an internship, mentioning specific skills, following up on an application, or is human and personable.

SPAM: Returns this if the email is an SEO sales pitch, a generic marketing bot, a 'website optimization' offer, or irrelevant junk.

CRITICAL: You must ignore polite fluff. Focus on the sender's intent.

        Email Sender: ${sender}
        Email Subject: ${subject}
        Email Body: ${body}`
      }]
    }],
    "generationConfig": {
      "temperature": 0.0,
      "responseMimeType": "application/json",
      "responseSchema": {
        "type": "object",
        "properties": {
          "verdict": {
            "type": "string",
            "enum": ["LEGIT", "SPAM"]
          }
        },
        "required": ["verdict"]
      }
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());
    var verdictStr = json.candidates[0].content.parts[0].text;
    return JSON.parse(verdictStr).verdict;
  } catch (error) {
    return "ERROR";
  }
}

function buildSidebarCard(verdict, subject) {
  var card = CardService.newCardBuilder();
  var section = CardService.newCardSection();

  if (verdict === "LEGIT") {
    var header = CardService.newCardHeader().setTitle("Legitimate Inquiry").setSubtitle("Ready to reply.");
    section.addWidget(CardService.newTextParagraph().setText("<b>Action:</b> This looks like a real student/human."));
    var action = CardService.newAction().setFunctionName("createDraftReply");
    section.addWidget(CardService.newTextButton().setText("Draft Internship Reply").setOnClickAction(action).setTextButtonStyle(CardService.TextButtonStyle.FILLED));
    card.setHeader(header);
  } else if (verdict === "SPAM") {
    var header = CardService.newCardHeader().setTitle("Potential Spam").setSubtitle("No action needed.");
    section.addWidget(CardService.newTextParagraph().setText("<b>Analysis:</b> This appears to be marketing or automated spam."));
    card.setHeader(header);
  } else {
    var header = CardService.newCardHeader().setTitle("Analysis Failed").setSubtitle("API Error");
    section.addWidget(CardService.newTextParagraph().setText("Could not analyze this email."));
    card.setHeader(header);
  }

  card.addSection(section);
  return card.build();
}

function createDraftReply(e) {
  var messageId = e.messageMetadata.messageId;
  var message = GmailApp.getMessageById(messageId);
  var thread = message.getThread();

  var replyBody = "Hi there,\n\nThank you for your interest in the internship program! Please send your resume and portfolio to us for review.\n\nBest,\nCinema Verde Team";

  thread.createDraftReply(replyBody);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Draft Created!"))
    .build();
}