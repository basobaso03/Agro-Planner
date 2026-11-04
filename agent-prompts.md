

l need to upgrade my application to a production stage but l see that the app is still having some serious issues that l idetifies:

1. when l am using the latest application, there is a badge that appears with the title "Agro planner Update (version), its elements are dark and the color is also dark that makes them not seen, all the elements must be of the main theme and black text color
2. there is that word "syndicate", we do not need this in the whole app, find it and remove it we do not need it 
3. the farm site is immutable, once created it cannot be edited or removes, yet we must have the CRUD operations as admin

- for a production grade application the livestock tab have many hardcoded and fixed, not flexible infomation and follows one fixed path that may not be the same, eg if l select the broilers the lifrcycle milestones ... section there are fixed hardcoded checkpoints that follow one path but in real life different people uses different methods and have different checkpoints, its better that when create the animal we allow the users to create their own checkpoints, create templates that they can select and heavily customise, with full CRUD operations, with advanced mathematics and date pickers and other tools that makes the users flexible. the other features must strictly preserved they are good. on the register new livestock it must upgraded with the plan that we are going to design above plus remive also that hardcoded categoriesspecies. in short the app must work as a tool that the users can cook their receipes of they use on their farms, 

- on the pool tab we need to make sure that the registration is smooth, we need an invitation code that the admin can give the user so that they can join their organisation, it expires after 24hrs, and its manually trigered by the admin to refresh a new one in the settings so that we reduce firebase costs, also when starting a company we, have the tartget money each member must contribute, theis must be configured so that if the users are contributing on montnly or at their own pace we will have the progress bar towards the each user has configured to contribute, depending on what they agreed, we need to define this carefully

- on ledger tab we need to make sure that the broadcast notify and reaches every one and have a dedicated opage that they are beautfully diaplayed

- then on roles we need to make sure that only admins must be the ones able to see this page it must be hidden to other users

- then the settings is a dumb of all things in one page and it is not categorised, we need to make it a clean categorised settings page, with icons, category title and some preview text of the settings in the category. on the biometric security the defaulty must be the fingerprint and the user must asked to enable it after first login/registration, and have , and l have seen also that the hide/show numbers can be easily bypassed then the user do like they are settting up, it must very strict. them ake the other content like security and access permission must competely hodden to regular users, the workspace typography and terrain appearance is not well designed for android app lets improve it fully, also diagonise why the passoword is always say not fonfugured if it was already configured, hide the syndicate admin section to users

- the above are just some the basic and baseline, you must start from there to and advanced profuction ready application, that allows users to apply their own, custom category freely although the audit logs are supposed to be immutable and record every event, foe transparent, identify also the left gaps and more features required to make this app a cool and usable tool


on the other thing is that l have someone that need an application that is related to this one but not specifically for farming, its other type of business the following is the description they gave me:

- we are contributing money where everyone is supposed to contribute a certain amount of money that that they confirmed that they are able to contribute. they we see our total contributed and when use/purchase something we login and provide infomation about the purchase and our money is automatically deducted by these operations, so that everyone in the group can see all whats happening, with their money in a transparent way, with good notifications of events and clean and clear infomation

- so what l was thinking is that my applcation can merge this and make it an advanced tool, this means that we need to change the name because the agro planner is tailored for agriculture we need to make it for this general purpose use, but l do not need it to be less usefull for agriculture context, l need it to be more perfect feet both sided, so we need to make sure that its advanced and perfectly fit both areas

- this means that we now introduce the organisations now, where each organisation one person the admin create the organisation and name it, then after login they can have the secret codes in the settings page they can give others to join their organisation, because, if anyone register or login without an organisation they must asked if they need to register or join the existing organisation, is join then use the organisation code. so we must fully develop the new organisation path to collect only relevent infomation to be used in our organisation, the admin have a code that autoatically expires after 24hrs, and can be manually refreshed if it expires. this means we are throwing away the admin approval way replacing it with code based login

- so you have to analyze how this can be encoporated to this application smoothly and make sure everyone has the good permissions, and the pictures are good to use, also we need to use the morden icons in our app. so from all what l have described l know there are a lot og=f gaps to be filled, new innovative ideas that can be used so l need you to add them fully so this app can be a great and usable app

requiremennts:
- a full implementation plan to upgrade this application to fit the described above and the new gaps and innovations that youre goin to add and how they are designed. the artifect must have the files to be created or modified and how so that te implementation will be easy also the tests to be used. so lets plan this advanced and professional app









l need you to read all the code implementation and the file capital-seed-implementation-plan.md and the files in workflow tests folder with the mind to verify is all the workflows in the application are included in the test plan and all the sites are tested, all validations rules are working for both general and farming, real data is used, and accounts are enough for thorough testing so identify is there are no missed subtil workflow in the tests and the scripts test from user side we need users to be able to do all the workflows after these teste also that one organisation cannot by any means see the other organisation money even if marlvin is the super admin, he must be blocked from seeing other organisation's money and also create his own organisation or data and the admin can promote or demote, change, reassign permissions to members, to make sure that the tests are 100% comprehensive and covers the whole application. we are not running any test yet we are still st planning phase



l have seen that there is need to categorise the infomation not that it will diaplay all info in the page


- on the capital seed workspace onboarding page, can you remove the text like Zero trust, and use 24 hr secret code, just say use code from existing organisation, also on the existing org tab remove the 24 hr expiration tab, 

- the vibration is annoying, we need to configure it in settings to turn it on or off
- remove all the preauthorise logic files in full, we do not need it now we use code based joining the organisation

- the species/category is still hardcoded and fixed, we can keep them but the problem is that is l have layers that are not 72 days, that is hardcoded to the category what will l do now as a famer, l am forced to use the name l dont want
- remove completely from the whole app the word gumboro its an explicity word in shona
- when adding a new recipe for an animal:
1. the page is going too much high on the phone and worse if l select the reset templete we need to fix this
2. l do not need to put the target day and the schedule calender date since the calender day can be automatically calculated from the target day since we know the day when the animal brought in/move in date

- on the post headcount contra adjustment make the text that is yellow in color be white which state "strictly immutability law:..."

- on the branch traking page there is a status for feed consumed but on the card there is no a quick button to add feed consumed, if there are no checkpoints then the feed cannot be loged so solve this, and also the card must not be dark let it use the color theme and must solve the text conflict when solving this

- l have seen that only checkpoints of the first added animal are displayed any other animal added they do not appear, and l am thinking to add them to their main card so that one button can be clicked to diaply them all in full for that specific animal not in the main page to avoid very large pages 

- everywhere where l need to upload a picture l have to select twice for it to be uploaded
- on registering a new fixed asset page the category is also fixed and not flexible, also remove the checkpoint that alows the user to check deduct or not money left, all the assets bought must always be deducted from the main remain pool, this section must be blank and nothing should be there. l see that even if available the money is still not being deducted from the pool especially if the money is bigger than the pool, there is no one we can puchase something with zero money

 - lastly on the settings page there is no invite code in organisation and team settings, also not all the infomation that was used during registering is appearing in this category, on the biometric fingureprint page the text "not configured yet, is ungly with three rows, on the about capoitalseed platform page remove the architecture engine and the platform deployment

so create an implementation plan for all the identified issues, with the files to be created or modified  and how, also create a full implementation file in in a folder you are going to create that is called " Frontend plan"












- can you look closely from this work flow, l added broilers(with the purchsed price and quantity) with zero money in the account and it succeeded, l added 250 then it remained 250, we need to solve this so that we remain with the accurate amount and give user warnings when they want to use negative money, where is that money comming from and why was it not looged. some may say we borrowed it but your application have no the option to record that since its not from the usersm and some may say we lend the money to others, and we used our own money before it was returned but the application do not have the option to record the money we gave others on credit

- some farmers complain that we sell on credit but we cannot log this on the application the dates we agreed, the notifications to all members, and know the breakdown of the money, we are also not able to log if we same a certain number of animals, configure selling prices, the income expected from the available animals, per animal and all animal

so this means we need to restructure our application, on the dasboard, that we add the specific paged for these operations, and l see that our navigation bar is now too small we can make the dashboard the icon-title-preview based with some columns like the mobile Banking Apps but more beautiful and advanced designed for moden app, so what do we do, we add these on the overview tab and and transfere the settings, ledger roles, broadcast, assets and pool so that the navigation bar is left with only three tabs this is much more cleaner. also on the dashboard we need to break down the money in our organisation such that we present the true money on the ground, net amount, expenses, borrowed(not paid yet), loans given(not yet returned), since we introduced other features. so you think what might everyone need to know with all these accounts then decide how best we can break down all the money so that everyone understand whats happening here, we need to make sure that all the areas are covers, then after this in the overview page comes our iconed pages then there after comes other things on the dashaboard

so we need a good implementation plan that can implement all these  issues infull detailing the files to be modifies or created without breaking the existing code, including your features and designs youre going to plan, then create that implementation plan file in a new folder called redesign plan 





how can l design a runway capital requirement for both agro and general business in an advanced way here. l am dreaming am module that allowa users to plan for their capital requirements. they think about all the requirements for the project to run upto break even point, so they plan events, what they want to buy, pay and each respective cost, then the total cost will be calculated as the things are being added and their costs, plus their choosen Contingency Buffer or meselenous buffer l am not sure what we call this in business, then the total cost is now detemined. then this gives the members how much they are able to provide, so each member is now pleging the amount he/she is able to provide and the satisfying progress bar will be moving. there should be some animation of the money flowing and the satisfying animations and the progress bar moving to show the money is being raised.
then everyone now start to pay towards their pledged money with the progress bar again, then the when they want to use the contributed money, they have to choose which event are they using money for and the paid event is marked as completed and the progress bar for the overal plan is update, if there was something that was not in the plan then they are force to add it to the plan, or add tothe contingency buffer, there is nothing that can be added without the sufficient money on the ground (not the contributed money, we mean money actually paid that had beed loged either from broowed or contibuted by members)

 the above is basic, and unstructured idea that need to be looked and think over it in full, then design the best module that is optional in our system that can help users to structure their money in their business, this module must be introduced to new users, to encourage them to use it but its optional to use, they can use the general features of the app. so l need you to develop the best advanced and moden design of this module you have to read the code in full, capital-seed-implementation-plan.md, all files in plans so that we have the module that is relevent to our application, and have the best and advanced features but it must be simple and easy to use for everyone, then create a new folder and write the implementation plan in the plans folder, with all the designs features, files to be modified or created, and how you will implement it step by step without breaking the existing code. how we are going to test the full workflow in workflow-tests folder and test with the existing ones so that we make sure  the workflows are working as expected and in full confidence



l observed the following issues while testing the app:
- when l open the app from the overview, when l click back the app exit instead of going to the previous page
- when l run the venue wizard it do not recognise the account type l am logged in with, because it askes me venture type, while l have registerd the business in one account type, we need to fix this such that. the contigency emegency is fixed, l cannot put what l want on top of that the step 3 is completely immutable and fixed (l cannot edit the slate and even if selected the final will be blank), also after save it direct to user management and role assignment console. also on 



- on the sales on credit page:
1. the 0 active element is ugly on small phones, also the record credit sale form must be a well sized that do not go too much on top pop up with amination from buttom up not in page form, and must also respond to keyboard,
2. the same is on loans, debits and liabilities

can you look at the UI, its poorly designed especially on the routing, there is no proper navigation system that stores the opened pages, the swiping rigt and left will display pages thet the user do not understand, all the forms that are in pages must made popups from buttom with a good amination, and must not go too much upwards, the overview page is not well designed with icons-title-preview columns like mobile banking apps. many inputs, forms are not actually senting data and l get nothing this means that there are bugs on  frontend, so lets dedicate this session on planning the complete UI and UX for the application to be a best android app since it use web technology it lacks some basic features that are available in android framework so identify them and add them here so the UI must be aligned and work with all what was implemented in files in plans folder and all the tests in workflow-tests folder so identify the gaps, bugs, and all the missing features and screens and create the impementation plan in the new folder you must create in plans folder, the plan must include all designs, gaps improvelents etc plus the files to be created or modified to fix all issues for both agro and general




the ob