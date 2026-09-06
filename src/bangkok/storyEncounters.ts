import type {StoryLine} from './adventureStory';
/** These encounters belong to The Last Ferry, using the same party, bag and save as exploration. */
export const storyEncounters: Record<'murmur'|'keeper',{actor:'wisp'|'shrine';title:string;enter:string;lines:StoryLine[]}>={
  murmur:{actor:'wisp',title:'A Murmur in the Mist',enter:'Face the Murmur with Su',lines:[
    {speaker:'Su',text:'The missing lantern spark is caught inside that spirit. We cannot restore the last ferry until we free it. Stay beside me, Patrick. This is our first fight together.'},
    {speaker:'Su',text:'The words you learned at the hotel can reach it. Patrick and I take turns: choose a word art, read what it means in English, then try the Thai aloud. We can inspect the enemy’s plan before committing. Speaking has no time limit.'},
    {speaker:'Su',text:'When the spirit answers, choose steady guard or try a timed dodge or parry. Our rice and tea come from the bag we carry through the city. If we need to retreat, we can rest with Mali and return. Ready?'}
  ]},
  keeper:{actor:'shrine',title:'The Keeper of Unsaid Words',enter:'Face the Keeper with Su',lines:[
    {speaker:'Su',text:'The spark we recovered answers the lantern, but the Keeper still holds the river passage shut. Everything we brought through the city matters here: our word arts, our talents, and the food our neighbours packed.'},
    {speaker:'Su',text:'Break or weaken the Keeper before its heavy third-round attack. Its Echo can heal it; a parry interrupts that healing. We fight together to restore the lantern. Then we can return to Niran and board the ferry.'}
  ]}
};
