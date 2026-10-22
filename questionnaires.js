/* Item IDs stay stable for a future Qualtrics mapping. Questions are optional.
   Duplicate blocks in the source are included once; see IMPLEMENTATION.md. */
(() => {
  const scale=(id,text,max=7,low='Not at all',high='Very much',mid='')=>({id,text,type:'scale',max,low,high,mid});
  const choice=(id,text,options)=>({id,text,type:'choice',options});
  const agree=(id,text)=>scale(id,text,5,'Strongly disagree','Strongly agree');
  window.QUESTIONNAIRES = {
    q1: [{title:'Your team',items:[
      choice('role','What is your role at Orbit Technologies?',['Junior Account Manager','Client Services Account Coordinator','Director of Client Services','Client Services Intern']),
      choice('team_size','How many employees do you have?',['1','2','3','4','5']),
      scale('familiarity','Based on your team members’ profiles, how well do you feel you know your team?',7,'Not at all','Very well'),
      {id:'team_comments',text:'Any comments about the team structure or your team members?',type:'text'}
    ]}],
    q2: [
      {title:'The employee email',intro:'Thinking about the email you received, to what extent did the message express:',items:
        ['Happy','Enthusiastic','Pleased','Proud','Optimistic','Content','Depressed','Frustrated','Angry','Disgusted','Unhappy','Disappointed','Embarrassed','Worried'].map(x=>scale('emotion_'+x.toLowerCase(),x,5,'Not at all','Extremely'))
      },

      {title:'Your reactions',items:[
        scale('competence_1','This email makes me feel that I am incompetent'),
        scale('competence_2','This email makes me feel that I am unsuccessful'),
        scale('competence_3','This email makes me feel that I am incapable of accomplishing things'),
        scale('competence_4','This email makes me feel that I can’t do things well'),
        scale('morality_1','This email makes me feel that I am immoral'),
        scale('morality_2','This email makes me feel that I don’t conform to the rules of proper conduct'),
        scale('morality_3','This email makes me feel that I am a bad person')
      ]},
      {title:'Your experience',intro:'In this situation I would…',items:[
        agree('generalized_1','…question my identity as a competent manager'),
        agree('generalized_2','…have doubts about myself as an effective manager'),
        agree('generalized_3','…wonder if my self-perception of being a good manager is accurate'),
        agree('generalized_4','…feel validated in my identity as a competent manager'),
        agree('generalized_5','…become more confident about myself as an effective manager'),
        agree('generalized_6','…feel affirmed in my self-perception of being a good manager')
      ]},
      {title:'The decision and email',items:[
        scale('leniency','Thinking about the scenario, please indicate how severe your punishment was:',7,'Very severe','Very lenient'),
        scale('dissent_shared','Thinking about the message you received, to what extent did it represent the shared view of multiple members of the team?',7,'No shared view','Completely shared view'),
        scale('dissent_agreement','Thinking about the message you received, to what extent did it indicate that multiple members of the team agreed with one another about your decision?',7,'No agreement','Full agreement','Some agreement')
      ]},
      {title:'Your leadership',items:[
        scale('legitimacy_1','To what extent do you have confidence in your leadership?',5,'Not at all','Completely'),
        scale('legitimacy_2','To what extent do you believe you have the support of your employees?',5,'Not at all','Completely'),
        scale('legitimacy_3','To what extent do you see yourself as the right and proper person for the position?',5,'Not at all','Completely'),
        scale('legitimacy_4','To what extent do you believe your employees see you as the right and proper person for the position?',5,'Not at all','Completely')
      ]}
    ],
    q3: [
      {title:'The proposed response',items:[
        scale('apology_likelihood','How likely are you to send the proposed response?',7,'Not at all','Very much'),
        scale('attention','Please select 3',7,'Not at all','Very much')
      ]},
      {title:'The workplace decision',items:[
        choice('decision_check','What action did you take regarding the employee who misled the client?',['Terminated the employee','Suspended the employee for one week','Issued the employee a warning','Promoted the employee'])
      ]},
      {title:'Your views',intro:'To what extent do you agree with the following statements?',items:[
        agree('power_distance_1','I don’t think managers need to consult their employees when making decisions'),
        agree('power_distance_2','I think it is often necessary for managers to exercise power and exert authority at work'),
        agree('power_distance_3','I think managers should not exchange opinions excessively with employees'),
        agree('power_distance_4','I think supervisors should avoid non-work-related interactions with employees'),
        agree('power_distance_5','I think employees should not question or oppose the decisions made by superiors'),
        agree('power_distance_6','I think superiors should not delegate important tasks to employees for resolution')
      ]},
      {title:'Demographics: your personal leadership experience',intro:'This question is about your own leadership experience outside of this simulation. Please answer about yourself, rather than the Director of Client Services role.',items:[
        choice('leadership_experience','How many years of personal leadership experience do you have outside of this simulation (if any)?',['Less than one month','1 month – 6 months','6 months – 1 year','2–3 years','4+ years'])
      ]}
    ]
  };
})();
